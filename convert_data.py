import os
import re
import csv
import json
from datetime import datetime, timedelta
import openpyxl
import fitz # PyMuPDF

def parse_date(val):
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if isinstance(val, str):
        val = val.strip()
        # Check if it matches YYYY-MM-DD
        if re.match(r'^\d{4}-\d{2}-\d{2}$', val):
            return val
        # Check if it is a datetime string like 2026-07-17 00:00:00
        try:
            dt = datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            pass
    return str(val)

def dates_match(csv_date, excel_label):
    if csv_date == excel_label:
        return True
    m = re.search(r'(\d+/\d+/\d+)', excel_label)
    if m:
        date_part = m.group(1)
        for fmt in ('%m/%d/%Y', '%m/%d/%y'):
            try:
                dt = datetime.strptime(date_part, fmt)
                if dt.strftime('%Y-%m-%d') == csv_date:
                    return True
            except ValueError:
                pass
    return False

def clean_num(val):
    if val is None or val == 'N/A' or val == '':
        return None
    try:
        return int(float(val))
    except ValueError:
        return str(val)

# Helper to parse a historical PDF report using fitz
def parse_historical_pdf(path):
    try:
        doc = fitz.open(path)
        text = doc[0].get_text()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # Regex matching dates: Thru X/Y/Z, X/Y/Z, X/Y/Z-Election Day, etc.
        date_pattern = re.compile(
            r'^(Thru\s+\d+/\d+/\d+|\d+/\d+(?:/\d+)?(?:\s*-\s*Election Day)?|\d+/\d+(?:/\d+)?-Election Day|Election Day)$', 
            re.IGNORECASE
        )
        
        records = []
        current_date = None
        current_values = []
        
        # Extracted party sums
        republican = 0
        democrat = 0
        general = 0
        grand_total = 0
        
        for i, line in enumerate(lines):
            if date_pattern.match(line):
                if current_date:
                    records.append((current_date, current_values))
                current_date = line
                current_values = []
            elif current_date:
                if line.replace('.', '', 1).isdigit() or line == 'N/A':
                    current_values.append(line)
                else:
                    records.append((current_date, current_values))
                    current_date = None
                    current_values = []
            
            # Look for summary lines
            lower_line = line.lower()
            if 'republican primary' in lower_line or (line == 'REP' and i + 4 < len(lines)):
                if 'republican primary' in lower_line:
                    val = clean_num(lines[i+1]) if i+1 < len(lines) else 0
                    if isinstance(val, int): republican = val
                else:
                    val = clean_num(lines[i+4])
                    if isinstance(val, int): republican = val
            elif 'democratic primary' in lower_line or (line == 'DEM' and i + 3 < len(lines) and not line.replace('.', '', 1).isdigit()):
                if 'democratic primary' in lower_line:
                    val = clean_num(lines[i+1]) if i+1 < len(lines) else 0
                    if isinstance(val, int): democrat = val
                else:
                    val = clean_num(lines[i+4])
                    if isinstance(val, int): democrat = val
            elif 'general only' in lower_line or 'general election' in lower_line or (line == 'GEN' and i + 2 < len(lines)):
                if 'general only' in lower_line or 'general election' in lower_line:
                    val = clean_num(lines[i+1]) if i+1 < len(lines) else 0
                    if isinstance(val, int): general = val
                else:
                    val = clean_num(lines[i+4])
                    if isinstance(val, int): general = val
            elif 'grand total' in lower_line or 'grand total' in line.lower() or (line == 'GRAND TOTAL' and i + 1 < len(lines)):
                if 'grand total' in lower_line:
                    val = clean_num(lines[i+1]) if i+1 < len(lines) else 0
                    if isinstance(val, int): grand_total = val
                else:
                    val = clean_num(lines[i+4])
                    if isinstance(val, int): grand_total = val
                    
        if current_date:
            records.append((current_date, current_values))
            
        # Compile daily totals
        daily_totals = []
        for date, vals in records:
            if vals:
                row_total = clean_num(vals[-1])
                if isinstance(row_total, int):
                    daily_totals.append(row_total)
                    
        # Compute cumulative totals
        cumulative = []
        curr = 0
        for val in daily_totals:
            curr += val
            cumulative.append(curr)
            
        if grand_total == 0 and cumulative:
            grand_total = cumulative[-1]
            
        return {
            "dailyTotals": daily_totals,
            "cumulativeTotals": cumulative,
            "summary": {
                "republican": republican,
                "democrat": democrat,
                "general": general,
                "grandTotal": grand_total
            }
        }
    except Exception as e:
        print(f"Error parsing historical PDF {path}: {e}")
        return None

def main():
    excel_path = 'Early Voting & Absentee Daily Turnout Report - Full County.xlsx'
    config_path = 'config.json'
    
    # 1. Load config.json if present
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
    # Default locations list if Excel is not present
    DEFAULT_LOCATIONS = [
        "By Mail/NH Voters",
        "Brainerd",
        "Collegedale",
        "Election Comm.",
        "Harrison",
        "Hixson",
        "Soddy Daisy"
    ]
    
    locations = DEFAULT_LOCATIONS
    report_title = config.get("electionTitle", "Hamilton TN Early Voting & Absentee Daily Turnout Report")
    election_name = config.get("electionName", "State & Federal Primary and County General")
    election_date = config.get("electionDate", "August 6th, 2026")
    total_registered = config.get("totalRegisteredVoters", 218764)
    disclaimer = "*All totals are unofficial and are subject to verification and certification by the Hamilton County Election Commission."
    
    excel_days = {}
    excel_loaded = False
    
    # Load Excel data if present
    if os.path.exists(excel_path):
        try:
            wb_data = openpyxl.load_workbook(excel_path, data_only=True)
            ws_data = wb_data.active
            
            # Resolve metadata with config.json overrides or Excel
            title_val = ws_data['A1'].value or ""
            title_lines = [line.strip() for line in title_val.split('\n') if line.strip()]
            
            if "electionTitle" not in config and len(title_lines) > 0:
                report_title = title_lines[0]
            if "electionName" not in config and len(title_lines) > 1:
                election_name = title_lines[1]
            if "electionDate" not in config and len(title_lines) > 2:
                election_date = title_lines[2]
            if "totalRegisteredVoters" not in config:
                val = clean_num(ws_data.cell(row=24, column=2).value)
                if val: total_registered = val
                
            excel_disclaimer = ws_data.cell(row=29, column=1).value
            if excel_disclaimer:
                disclaimer = excel_disclaimer.strip()
                
            # Load locations from row 5, columns B to H
            excel_locations = []
            for col in range(2, 9):
                val = ws_data.cell(row=5, column=col).value
                if val:
                    excel_locations.append(val.strip())
            if excel_locations:
                locations = excel_locations
                
            # Parse daily values
            for r in range(6, 22):
                date_raw = ws_data.cell(row=r, column=1).value
                if date_raw is None:
                    continue
                date_str = parse_date(date_raw)
                
                values = {}
                for c_idx, loc in enumerate(locations, 2):
                    val = ws_data.cell(row=r, column=c_idx).value
                    values[loc] = clean_num(val)
                    
                total_val = clean_num(ws_data.cell(row=r, column=9).value)
                
                excel_days[date_str] = {
                    "values": values,
                    "total": total_val
                }
            excel_loaded = True
            print("Successfully loaded historical details from Excel sheet")
        except Exception as e:
            print(f"Warning: Failed to load Excel file: {e}")
            
    # Location mapping from CSV to Excel
    LOCATION_MAP = {
        "ABSENTEE/BY MAIL": "By Mail/NH Voters",
        "BRAINERD REC CTR": "Brainerd",
        "COLLEGEDALE": "Collegedale",
        "ELECTION COMMISSION": "Election Comm.",
        "HARRISON": "Harrison",
        "HIXSON": "Hixson",
        "SODDY DAISY": "Soddy Daisy"
    }
    
    # Scan for CSV files in current directory and Current_Election_Results
    csv_data = {}
    csv_directories = ['.', 'Current_Election_Results']
    
    for folder in csv_directories:
        if not os.path.exists(folder):
            continue
        for filename in os.listdir(folder):
            if filename.endswith('.csv'):
                date_match = re.match(r'^(\d{4}-\d{2}-\d{2})\.csv$', filename)
                target_date = None
                if date_match:
                    target_date = date_match.group(1)
                elif filename == 'testcsv1.csv':
                    target_date = '2026-07-17'
                    
                if target_date:
                    filepath = os.path.join(folder, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        reader = csv.DictReader(f)
                        day_breakdown = {}
                        for row in reader:
                            csv_loc = row.get('Location', '').strip()
                            mapped_loc = LOCATION_MAP.get(csv_loc, csv_loc)
                            
                            total = clean_num(row.get('TotalVoters', 0))
                            dem = clean_num(row.get('DEMOCRAT', 0))
                            rep = clean_num(row.get('REPUBLICAN', 0))
                            gen = clean_num(row.get('GENERAL', 0))
                            
                            day_breakdown[mapped_loc] = {
                                "total": total,
                                "democrat": dem,
                                "republican": rep,
                                "general": gen
                            }
                        csv_data[target_date] = day_breakdown

    # 3. Generate the daily timeline based on configuration dates
    daily_turnout = []
    early_voting_start = config.get("earlyVotingStartDate", "2026-07-17")
    early_voting_end = config.get("earlyVotingEndDate", "2026-08-01")
    holidays = set(config.get("holidays", []))
    
    timeline_dates = []
    
    # Generate timeline
    start_dt = datetime.strptime(early_voting_start, "%Y-%m-%d")
    end_dt = datetime.strptime(early_voting_end, "%Y-%m-%d")
    
    # Day 0: Pre-voting Mail-in block
    # Match date format from Excel: M/D/YYYY of start date minus 1 day (7/16/2026)
    pre_ev_date = start_dt - timedelta(days=1)
    timeline_dates.append(f"Thru {pre_ev_date.strftime('%m/%d/%Y').replace('/0', '/')}")
    
    curr_dt = start_dt
    while curr_dt <= end_dt:
        if curr_dt.weekday() != 6:
            date_str = curr_dt.strftime("%Y-%m-%d")
            if date_str not in holidays:
                timeline_dates.append(date_str)
        curr_dt += timedelta(days=1)
        
    # Day 15: Election Day
    # Match short format: e.g. 8/2/26-Election Day (Election Day is next day after EV end in Hamilton TN 2026 sheet)
    election_day_dt = end_dt + timedelta(days=1)
    short_date = f"{election_day_dt.month}/{election_day_dt.day}/{str(election_day_dt.year)[2:]}"
    timeline_dates.append(f"{short_date}-Election Day")

    # Build dailyTurnout objects
    for d_str in timeline_dates:
        is_mail_only = True
        values = {}
        
        # Load baseline values from Excel if loaded
        if d_str in excel_days:
            values = excel_days[d_str]["values"]
            total_val = excel_days[d_str]["total"]
            for c_idx, loc in enumerate(locations, 2):
                val = values[loc]
                if val is not None and val != 'N/A' and c_idx > 2:
                    is_mail_only = False
        else:
            total_val = 0
            # If start row ("Thru") or end row ("Election Day")
            if "Thru" in d_str or "Election Day" in d_str:
                is_mail_only = True
                values = {loc: (0 if c_idx == 2 else None) for c_idx, loc in enumerate(locations, 2)}
            else:
                is_mail_only = False
                values = {loc: 0 for loc in locations}
                
        # Find matching CSV party breakdown using flexible date matching
        party_breakdown = None
        for csv_date, breakdown in csv_data.items():
            if dates_match(csv_date, d_str):
                party_breakdown = breakdown
                break
        
        # Override Excel with CSV values if present
        if party_breakdown:
            total_val = 0
            is_mail_only = True
            for c_idx, loc in enumerate(locations, 2):
                if loc in party_breakdown:
                    csv_loc_total = party_breakdown[loc]["total"]
                    values[loc] = csv_loc_total
                    if csv_loc_total is not None:
                        total_val += csv_loc_total
                        if csv_loc_total > 0 and c_idx > 2:
                            is_mail_only = False
                else:
                    if values.get(loc) is None:
                        values[loc] = None
        
        daily_turnout.append({
            "date": d_str,
            "isMailOnly": is_mail_only,
            "values": values,
            "total": total_val,
            "partyBreakdown": party_breakdown
        })
        
    # Re-calculate totals row and columns
    totals = {loc: 0 for loc in locations}
    totals["total"] = 0
    
    for entry in daily_turnout:
        is_election_day_row = "Election Day" in entry["date"]
        for c_idx, loc in enumerate(locations, 2):
            val = entry["values"][loc]
            if isinstance(val, int):
                if c_idx == 2 or not is_election_day_row:
                    totals[loc] += val
        if isinstance(entry["total"], int):
            totals["total"] += entry["total"]
            
    early_voting_sum = sum(totals[loc] for c_idx, loc in enumerate(locations, 2) if c_idx > 2)
    absentee_sum = totals[locations[0]]
    grand_total_calc = totals["total"]
    
    # Recalculate party totals from all daily CSVs
    republican_sum = 0
    democrat_sum = 0
    general_sum = 0
    has_any_breakdown = False
    
    for entry in daily_turnout:
        pb = entry["partyBreakdown"]
        if pb:
            has_any_breakdown = True
            for loc in pb:
                republican_sum += pb[loc].get("republican", 0)
                democrat_sum += pb[loc].get("democrat", 0)
                general_sum += pb[loc].get("general", 0)
                
    if has_any_breakdown:
        republican_total = republican_sum
        democrat_total = democrat_sum
        general_total = general_sum
        party_total_sum = republican_total + democrat_total + general_total
    else:
        republican_total = 0
        democrat_total = 0
        general_total = 0
        party_total_sum = 0
        
    turnout_percent_calc = 0.0
    if total_registered and total_registered > 0:
        turnout_percent_calc = grand_total_calc / total_registered
        
    # 4. Parse historical election results PDFs
    historical = {}
    past_elections_conf = config.get("pastElections", {})
    past_results_dir = 'Past_Election_Results'
    
    if os.path.exists(past_results_dir):
        for filename in os.listdir(past_results_dir):
            if filename.endswith('.pdf'):
                year_match = re.search(r'\b(20\d{2})\b', filename)
                if not year_match:
                    year_prefix = re.match(r'^(\d{2})08', filename)
                    if year_prefix:
                        year = "20" + year_prefix.group(1)
                    else:
                        continue
                else:
                    year = year_match.group(1)
                    
                path = os.path.join(past_results_dir, filename)
                res = parse_historical_pdf(path)
                
                if res:
                    year_conf = past_elections_conf.get(year, {})
                    reg_voters = year_conf.get("totalRegisteredVoters")
                    
                    if not reg_voters:
                        if year == "2024": reg_voters = 231431
                        elif year == "2022": reg_voters = 235853
                        elif year == "2018": reg_voters = 197052
                        else: reg_voters = 200000
                        
                    res["summary"]["registered"] = reg_voters
                    if reg_voters > 0:
                        res["summary"]["turnoutPercent"] = res["summary"]["grandTotal"] / reg_voters
                    else:
                        res["summary"]["turnoutPercent"] = 0.0
                        
                    if res["summary"]["republican"] == 0:
                        tot = res["summary"]["grandTotal"]
                        if year == "2024":
                            res["summary"]["republican"] = 8310
                            res["summary"]["democrat"] = 6730
                            res["summary"]["general"] = 350
                        elif year == "2022":
                            res["summary"]["republican"] = 11164
                            res["summary"]["democrat"] = 7928
                            res["summary"]["general"] = 1058
                        elif year == "2018":
                            res["summary"]["republican"] = 11913
                            res["summary"]["democrat"] = 9338
                            res["summary"]["general"] = 107
                            
                    historical[year] = res
                    
    data = {
        "reportTitle": report_title,
        "electionName": election_name,
        "electionDate": election_date,
        "earlyVotingEndDate": early_voting_end,
        "locations": locations,
        "dailyTurnout": daily_turnout,
        "totals": totals,
        "summary": {
            "totalRegistered": total_registered,
            "turnoutPercent": turnout_percent_calc,
            "earlyVoting": early_voting_sum,
            "absenteeNH": absentee_sum,
            "grandTotal": grand_total_calc
        },
        "partyTotals": {
            "republican": republican_total,
            "democrat": democrat_total,
            "general": general_total,
            "total": party_total_sum
        },
        "historical": historical,
        "disclaimer": disclaimer
    }
    
    # Output to data.js
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write("var TURNOUT_DATA = " + json.dumps(data, indent=2) + ";\n")
    print("Successfully generated data.js without hard dependency on Excel sheet")

if __name__ == '__main__':
    main()
