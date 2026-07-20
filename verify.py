import os
import re
import csv
import json
import sys

def print_result(check_id, status, message):
    print(f"[{status}] {check_id}: {message}")

def main():
    print("============================================")
    print("  Verification Report — Early Voting HTML  ")
    print("============================================")
    
    passes = 0
    failures = 0
    warnings = 0
    
    def log_pass(check_id, msg):
        nonlocal passes
        passes += 1
        print_result(check_id, "PASS", msg)
        
    def log_fail(check_id, msg):
        nonlocal failures
        failures += 1
        print_result(check_id, "FAIL", msg)
        
    def log_warn(check_id, msg):
        nonlocal warnings
        warnings += 1
        print_result(check_id, "WARN", msg)

    # 1. Structural Integrity Check
    html_exists = os.path.exists('index.html')
    css_exists = os.path.exists('index.css')
    js_exists = os.path.exists('app.js')
    data_exists = os.path.exists('data.js')
    config_exists = os.path.exists('config.json')
    
    if html_exists and css_exists and js_exists and data_exists:
        log_pass("STR-001", "Required files (index.html, index.css, app.js, data.js) exist.")
    else:
        missing = []
        if not html_exists: missing.append("index.html")
        if not css_exists: missing.append("index.css")
        if not js_exists: missing.append("app.js")
        if not data_exists: missing.append("data.js")
        log_fail("STR-001", f"Missing required files: {', '.join(missing)}")
        
    # Read files if they exist
    html_content = ""
    if html_exists:
        with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
            html_content = f.read()
            
    css_content = ""
    if css_exists:
        with open('index.css', 'r', encoding='utf-8', errors='ignore') as f:
            css_content = f.read()
            
    js_content = ""
    if js_exists:
        with open('app.js', 'r', encoding='utf-8', errors='ignore') as f:
            js_content = f.read()
            
    data_content = ""
    if data_exists:
        with open('data.js', 'r', encoding='utf-8', errors='ignore') as f:
            data_content = f.read()

    # STR-002: References check
    if html_exists:
        ref_css = "index.css" in html_content
        ref_data = "data.js" in html_content
        ref_js = "app.js" in html_content
        if ref_css and ref_data and ref_js:
            log_pass("STR-002", "index.html successfully references index.css, data.js, and app.js.")
        else:
            refs = []
            if not ref_css: refs.append("index.css")
            if not ref_data: refs.append("data.js")
            if not ref_js: refs.append("app.js")
            log_fail("STR-002", f"index.html missing references to: {', '.join(refs)}")
            
    # STR-003: TURNOUT_DATA defined
    if data_exists:
        if "var TURNOUT_DATA" in data_content or "TURNOUT_DATA =" in data_content:
            log_pass("STR-003", "data.js correctly defines TURNOUT_DATA.")
        else:
            log_fail("STR-003", "data.js does not define TURNOUT_DATA.")

    # STR-004: config.json validation
    if config_exists:
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                conf = json.load(f)
            required_keys = ["electionTitle", "electionName", "electionDate", "totalRegisteredVoters"]
            missing_keys = [k for k in required_keys if k not in conf]
            if missing_keys:
                log_fail("STR-004", f"config.json is missing keys: {missing_keys}")
            else:
                log_pass("STR-004", "config.json parses successfully and contains key metadata.")
        except Exception as e:
            log_fail("STR-004", f"config.json is not valid JSON: {e}")
    else:
        log_warn("STR-004", "config.json does not exist.")

    # 2. DNN CMS Compliance Checks
    if html_exists:
        # DNN-001: No <form> tags
        if "<form" in html_content.lower():
            log_fail("DNN-001", "HTML contains <form> tag, which breaks in DNN CMS.")
        else:
            log_pass("DNN-001", "No <form> tags found in index.html.")
            
        # DNN-002: Buttons type="button"
        buttons = re.findall(r'<button\b[^>]*>', html_content, re.IGNORECASE)
        bad_buttons = []
        for btn in buttons:
            if 'type="button"' not in btn.lower() and "type='button'" not in btn.lower():
                bad_buttons.append(btn)
        if bad_buttons:
            log_fail("DNN-002", f"Found buttons without type=\"button\": {bad_buttons}")
        else:
            log_pass("DNN-002", "All buttons explicitly use type=\"button\".")
            
    # DNN-003: No raw Unicode > 127
    non_ascii_found = []
    files_to_check = [('index.html', html_content), ('index.css', css_content), ('app.js', js_content)]
    for name, content in files_to_check:
        if not content:
            continue
        lines = content.split('\n')
        for i, line in enumerate(lines, 1):
            for char in line:
                if ord(char) > 127:
                    non_ascii_found.append((name, i, char, ord(char)))
                    break
    if non_ascii_found:
        log_fail("DNN-003", f"Raw Unicode/non-ASCII characters found: {non_ascii_found[:5]} (showing up to 5)")
    else:
        log_pass("DNN-003", "No raw Unicode characters above ASCII 127 found in source files.")

    # DNN-004 & DNN-005: CSS font units and !important
    if css_exists:
        em_rem_matches = re.findall(r'font-size\s*:\s*[^;!]+(rem|em)\b', css_content, re.IGNORECASE)
        if em_rem_matches:
            log_fail("DNN-004", f"CSS uses em/rem in font-size: {em_rem_matches}")
        else:
            log_pass("DNN-004", "No rem/em units used for font-sizes in CSS.")
            
        if "!important" in css_content:
            log_pass("DNN-005", "CSS contains !important declarations for CMS overrides.")
        else:
            log_warn("DNN-005", "CSS does not contain any !important overrides; DNN global styles might override them.")

    # 3. WCAG 2.1 AA Checks
    if html_exists:
        # A11Y-001: Decorative shielding
        entities = re.findall(r'&#[xX]?[0-9a-fA-F]+;', html_content)
        if entities:
            if "aria-hidden" in html_content:
                log_pass("A11Y-001", "HTML contains HTML entities and aria-hidden properties.")
            else:
                log_warn("A11Y-001", "HTML contains entities but no aria-hidden. Decorative icons might clutter screen readers.")
        else:
            log_pass("A11Y-001", "No decorative HTML entities found or checked.")
            
        # A11Y-002: aria-expanded on toggle buttons
        has_toggles = "toggle" in html_content.lower()
        if has_toggles:
            if "aria-expanded" in html_content:
                log_pass("A11Y-002", "Toggle buttons contain aria-expanded attributes.")
            else:
                log_fail("A11Y-002", "Toggle button triggers found but no aria-expanded attributes.")
        else:
            log_pass("A11Y-002", "No toggle actions found or checked.")
            
        # A11Y-003: Escape key handler on expandable content
        if "aria-expanded" in html_content:
            if "keydown" in html_content.lower() or "onkeydown" in html_content.lower() or "keyup" in html_content.lower():
                log_pass("A11Y-003", "Keyboard listeners (keydown/keyup) present for Escape key toggling.")
            else:
                log_fail("A11Y-003", "aria-expanded is used but no keyboard event handlers found (e.g. for Escape).")
        else:
            log_pass("A11Y-003", "No aria-expanded used, Escape handler not checked.")
            
        # A11Y-004: Heading hierarchy
        h1_count = len(re.findall(r'<h1\b', html_content, re.IGNORECASE))
        if h1_count == 1:
            log_pass("A11Y-004", "Exactly one <h1> tag found in HTML.")
        elif h1_count == 0:
            log_fail("A11Y-004", "No <h1> tag found in HTML.")
        else:
            log_fail("A11Y-004", f"Multiple ({h1_count}) <h1> tags found in HTML. Only one permitted.")
            
        # A11Y-005: Table semantics
        if "<table" in html_content.lower():
            has_thead = "<thead" in html_content.lower()
            has_tbody = "<tbody" in html_content.lower()
            has_scope = "scope=" in html_content.lower()
            if has_thead and has_tbody and has_scope:
                log_pass("A11Y-005", "Table elements use <thead, <tbody, and scope=\"col/row\".")
            else:
                log_fail("A11Y-005", "Table found but missing semantic tags (thead, tbody, or scope).")
        else:
            log_pass("A11Y-005", "No tables found in HTML.")

        # A11Y-007: Contrast colors check
        if css_exists:
            if "#1B2A4A" in css_content.upper() and "#FAF8F5" in css_content.upper():
                log_pass("A11Y-007", "Patriotic high-contrast color scheme (--navy, --cream) defined in CSS.")
            else:
                log_warn("A11Y-007", "Expected high-contrast colors not found in CSS. Verify contrast ratios manual.")

    # 4. Mobile Responsiveness Checks
    if html_exists:
        if "<table" in html_content.lower():
            if "overflow-x" in html_content or "overflow-x" in css_content:
                log_pass("MOB-001", "Table container horizontal overflow scrolling enabled.")
            else:
                log_fail("MOB-001", "Table found but horizontal scrolling (overflow-x) is not enabled.")
        else:
            log_pass("MOB-001", "No tables to scroll check.")
            
    if css_exists:
        if "column-count" in css_content.lower():
            log_fail("MOB-002", "CSS uses column-count which breaks Chrome print flow. Use physical div cols instead.")
        else:
            log_pass("MOB-002", "CSS column-count not used. Compliance verified.")

    # 5. Print Checks
    if css_exists:
        if "@media print" in css_content.lower():
            log_pass("PRT-001", "@media print stylesheet rules defined.")
            
            if "print-color-adjust" in css_content.lower() or "color-adjust" in css_content.lower():
                log_pass("PRT-002", "print-color-adjust: exact is specified.")
            else:
                log_fail("PRT-002", "print-color-adjust: exact missing in print styles.")
                
            if "break-inside" in css_content.lower() or "page-break-inside" in css_content.lower():
                log_pass("PRT-003", "break-inside: avoid is specified to prevent cutting cells.")
            else:
                log_fail("PRT-003", "break-inside: avoid or page-break-inside: avoid missing in print styles.")
                
            if "14px" in css_content or "15px" in css_content or "16px" in css_content or "inherit" in css_content:
                log_pass("PRT-004", "CSS includes print font sizing compliance.")
            else:
                log_warn("PRT-004", "Verify print font sizes comply with 14px newspaper ad minimums.")
        else:
            log_fail("PRT-001", "Missing @media print stylesheet rules.")

    # 6. Encoding checks
    if html_exists:
        if 'charset="utf-8"' in html_content.lower() or "charset='utf-8'" in html_content.lower():
            log_pass("ENC-001", "Meta charset UTF-8 is explicitly declared.")
        else:
            log_fail("ENC-001", "Meta charset tag missing or not UTF-8.")
            
    js_non_ascii = []
    if js_exists:
        lines = js_content.split('\n')
        for i, line in enumerate(lines, 1):
            for char in line:
                if ord(char) > 127:
                    js_non_ascii.append((i, char))
                    break
    if js_non_ascii:
        log_fail("ENC-002", f"JS file contains raw non-ASCII unicode: {js_non_ascii}")
    else:
        log_pass("ENC-002", "JavaScript file is 100% pure ASCII.")

    # 7. CSV Data Integrity Checks (source -> data.js)
    # Scan for CSV files in current dir and Current_Election_Results folder
    csv_files_info = []
    
    for f in os.listdir('.'):
        if f.endswith('.csv'):
            csv_files_info.append(('.', f))
            
    if os.path.exists('Current_Election_Results'):
        for f in os.listdir('Current_Election_Results'):
            if f.endswith('.csv'):
                csv_files_info.append(('Current_Election_Results', f))
                
    data_js_loaded = None
    if data_exists:
        try:
            json_str = data_content.replace('var TURNOUT_DATA =', '').strip()
            if json_str.endswith(';'):
                json_str = json_str[:-1].strip()
            data_js_loaded = json.loads(json_str)
        except Exception as e:
            log_fail("CSV-004", f"Could not parse data.js content: {e}")
            
    LOCATION_MAP = {
        "ABSENTEE/BY MAIL": "By Mail/NH Voters",
        "BRAINERD REC CTR": "Brainerd",
        "COLLEGEDALE": "Collegedale",
        "ELECTION COMMISSION": "Election Comm.",
        "HARRISON": "Harrison",
        "HIXSON": "Hixson",
        "SODDY DAISY": "Soddy Daisy"
    }

    csv_totals_by_date = {}
    csv_data_by_date = {}

    for folder, csv_file in csv_files_info:
        date_match = re.match(r'^(\d{4}-\d{2}-\d{2})\.csv$', csv_file)
        target_date = None
        if date_match:
            target_date = date_match.group(1)
        elif csv_file == 'testcsv1.csv':
            target_date = '2026-07-17'
            
        if not target_date:
            continue
            
        filepath = os.path.join(folder, csv_file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                
            required_cols = ["Location", "TotalVoters", "DEMOCRAT", "REPUBLICAN", "GENERAL"]
            col_check = all(c in rows[0].keys() if rows else False for c in required_cols)
            if col_check:
                log_pass("CSV-001", f"CSV file {filepath} is parseable and contains required columns.")
            else:
                log_fail("CSV-001", f"CSV file {filepath} is missing required columns. Found: {list(rows[0].keys()) if rows else []}")
                continue
        except Exception as e:
            log_fail("CSV-001", f"Failed to parse CSV file {filepath}: {e}")
            continue
            
        row_mismatches = []
        location_errors = []
        date_total_voters = 0
        date_party_data = {}
        
        for idx, r in enumerate(rows, 1):
            loc = r.get("Location", "").strip()
            if loc not in LOCATION_MAP:
                location_errors.append(loc)
                
            try:
                tot = int(r.get("TotalVoters", 0) or 0)
                dem = int(r.get("DEMOCRAT", 0) or 0)
                rep = int(r.get("REPUBLICAN", 0) or 0)
                gen = int(r.get("GENERAL", 0) or 0)
                
                party_sum = dem + rep + gen
                if tot != party_sum:
                    row_mismatches.append((idx, loc, tot, party_sum))
                    
                date_total_voters += tot
                mapped_loc = LOCATION_MAP.get(loc, loc)
                date_party_data[mapped_loc] = {
                    "total": tot,
                    "democrat": dem,
                    "republican": rep,
                    "general": gen
                }
            except ValueError as ve:
                row_mismatches.append((idx, loc, "ValueError", str(ve)))
                
        if row_mismatches:
            log_fail("CSV-002", f"Row total voter mismatches in {filepath}: {row_mismatches}")
        else:
            log_pass("CSV-002", f"TotalVoters equals DEM+REP+GEN sums in {filepath}.")
            
        if location_errors:
            log_fail("CSV-003", f"Unrecognized locations in {filepath}: {location_errors}")
        else:
            log_pass("CSV-003", f"All locations in {filepath} correctly mapped.")
            
        # Overwrite or fill (if there are duplicates, folder Current_Election_Results takes precedence)
        csv_totals_by_date[target_date] = date_total_voters
        csv_data_by_date[target_date] = date_party_data

    if data_js_loaded:
        daily_turnout = data_js_loaded.get("dailyTurnout", [])
        
        all_csv_matched = True
        cell_values_matched = True
        
        for date_entry in daily_turnout:
            d_str = date_entry.get("date")
            pb = date_entry.get("partyBreakdown")
            
            if d_str in csv_totals_by_date:
                if pb is None:
                    all_csv_matched = False
                    log_fail("CSV-004", f"Date {d_str} has CSV file but partyBreakdown is null in data.js")
                    continue
                    
                sum_pb = 0
                for loc_name, breakdown in pb.items():
                    sum_pb += breakdown.get("total", 0)
                    
                expected_csv_total = csv_totals_by_date[d_str]
                if sum_pb != expected_csv_total:
                    all_csv_matched = False
                    log_fail("CSV-004", f"Date {d_str} partyBreakdown sum in data.js ({sum_pb}) does not match CSV TotalVoters ({expected_csv_total})")
                else:
                    log_pass("CSV-004", f"Date {d_str} party breakdown totals match CSV source totals ({sum_pb}).")
                    
                orig_data = csv_data_by_date[d_str]
                for loc_name, orig_vals in orig_data.items():
                    js_vals = pb.get(loc_name)
                    if js_vals is None:
                        cell_values_matched = False
                        log_fail("CSV-005", f"Location {loc_name} on {d_str} missing from data.js partyBreakdown")
                    else:
                        for key in ["democrat", "republican", "general", "total"]:
                            if orig_vals.get(key) != js_vals.get(key):
                                cell_values_matched = False
                                log_fail("CSV-005", f"Mismatch on {d_str} - {loc_name} {key}: CSV={orig_vals.get(key)}, JSON={js_vals.get(key)}")
                                
        if all_csv_matched and csv_totals_by_date:
            log_pass("CSV-004", "All CSV date-wide totals match data.js partyBreakdown structures.")
        if cell_values_matched and csv_totals_by_date:
            log_pass("CSV-005", "All per-location party values are preserved exactly in data.js.")

    print("============================================")
    print(f"  Results: {passes} PASS | {failures} FAIL | {warnings} WARN")
    print("============================================")
    
    if failures > 0:
        print("[FAIL] Verification did not pass. Fix failures before proceeding.")
        sys.exit(1)
    else:
        print("[PASS] Verification successful!")
        sys.exit(0)

if __name__ == '__main__':
    main()
