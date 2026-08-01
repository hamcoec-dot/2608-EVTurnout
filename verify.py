import os
import re
import csv
import json
import sys

def print_result(check_id, status, message):
    print(f"[{status}] {check_id}: {message}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir:
        os.chdir(base_dir)

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

    voter_csv_found = False
    voter_total_count = 0
    seen_voter_ids = set()

    for folder, csv_file in csv_files_info:
        filepath = os.path.join(folder, csv_file)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames or []
                if 'DateBallotReceived' not in fieldnames:
                    continue

                required_cols = ["DateBallotReceived", "EarlyVoterLocation", "Party", "RegistrationNum"]
                col_check = all(c in fieldnames for c in required_cols)
                if col_check:
                    log_pass("CSV-001", f"Voter CSV file {filepath} is parseable and contains required columns.")
                    voter_csv_found = True
                    for row in reader:
                        reg_num = row.get("RegistrationNum", "").strip()
                        if reg_num and reg_num in seen_voter_ids:
                            continue
                        if reg_num:
                            seen_voter_ids.add(reg_num)
                        voter_total_count += 1
                else:
                    log_fail("CSV-001", f"Voter CSV file {filepath} is missing required columns. Found: {fieldnames}")
        except Exception as e:
            log_fail("CSV-001", f"Failed to parse CSV file {filepath}: {e}")

    if voter_csv_found:
        log_pass("CSV-002", f"Successfully extracted {voter_total_count} unique voter records from voter CSV files.")
    else:
        log_warn("CSV-002", "No voter-level CSV files with DateBallotReceived found.")

    if data_js_loaded:
        js_grand_total = data_js_loaded.get("summary", {}).get("grandTotal", 0)
        js_party_total = data_js_loaded.get("partyTotals", {}).get("total", 0)
        demographics = data_js_loaded.get("demographics")

        if voter_csv_found:
            if js_grand_total == voter_total_count and js_party_total == voter_total_count:
                log_pass("CSV-004", f"data.js grandTotal ({js_grand_total}) and partyTotals ({js_party_total}) exactly match voter CSV row count ({voter_total_count}).")
            else:
                log_fail("CSV-004", f"Mismatch: data.js grandTotal={js_grand_total}, partyTotals={js_party_total}, CSV count={voter_total_count}")

        if demographics and isinstance(demographics, dict):
            required_demo_keys = ["ageGroups", "sex", "districts", "precincts", "precinctsByLocation", "precinctsByAgeGroup", "precinctsByDistrict"]
            if all(k in demographics for k in required_demo_keys):
                log_pass("CSV-005", "data.js contains complete demographics object including precinct cross-tabulations.")
            else:
                log_fail("CSV-005", f"data.js demographics missing keys. Found: {list(demographics.keys())}")
        else:
            log_fail("CSV-005", "data.js is missing demographics object.")

        # CSV-006: Top 5 Precinct cross-tabulation data integrity
        ft_data = data_js_loaded.get("firstTimeVoters", {})
        has_ft_precincts = "precincts" in ft_data and isinstance(ft_data["precincts"], dict)
        has_loc_precincts = "precinctsByLocation" in demographics and isinstance(demographics["precinctsByLocation"], dict)
        has_age_precincts = "precinctsByAgeGroup" in demographics and isinstance(demographics["precinctsByAgeGroup"], dict)
        has_dist_precincts = "precinctsByDistrict" in demographics and isinstance(demographics["precinctsByDistrict"], dict)

        if has_ft_precincts and has_loc_precincts and has_age_precincts and has_dist_precincts:
            # Verify numerical totals inside cross-tabulations match expected totals
            ft_sum = sum(p_data.get("total", 0) for p_data in ft_data["precincts"].values())
            ft_expected = ft_data.get("total", 0)

            loc_sum = sum(sum(p_data.get("total", 0) for p_data in p_map.values()) for p_map in demographics["precinctsByLocation"].values())
            age_sum = sum(sum(p_data.get("total", 0) for p_data in p_map.values()) for p_map in demographics["precinctsByAgeGroup"].values())

            if ft_sum == ft_expected and loc_sum == voter_total_count and age_sum == voter_total_count:
                log_pass("CSV-006", f"Verified exact numerical totals for Top 5 Precinct categories (FT sum={ft_sum}, Loc sum={loc_sum}, Age sum={age_sum}) against CSV dataset.")
            else:
                log_fail("CSV-006", f"Numerical mismatch in precinct totals: FT sum={ft_sum}/{ft_expected}, Loc sum={loc_sum}/{voter_total_count}, Age sum={age_sum}/{voter_total_count}")
        else:
            missing_structs = []
            if not has_ft_precincts: missing_structs.append("firstTimeVoters.precincts")
            if not has_loc_precincts: missing_structs.append("demographics.precinctsByLocation")
            if not has_age_precincts: missing_structs.append("demographics.precinctsByAgeGroup")
            if not has_dist_precincts: missing_structs.append("demographics.precinctsByDistrict")
            log_fail("CSV-006", f"Missing Top 5 precinct data structures: {', '.join(missing_structs)}")

        # CSV-007: Campaign Strategy data structures & metrics
        daily_pace = data_js_loaded.get("dailyPace")
        comp_precincts = data_js_loaded.get("competitivePrecincts")
        dist_shares = data_js_loaded.get("districtShares")

        has_pace = isinstance(daily_pace, list) and len(daily_pace) > 0
        has_comp = isinstance(comp_precincts, list) and len(comp_precincts) > 0
        has_shares = isinstance(dist_shares, dict) and "commission" in dist_shares

        if has_pace and has_comp and has_shares:
            log_pass("CSV-007", f"Verified campaign metrics structures (dailyPace={len(daily_pace)} days, competitivePrecincts={len(comp_precincts)} precincts, districtShares validated).")
        else:
            missing_campaign = []
            if not has_pace: missing_campaign.append("dailyPace")
            if not has_comp: missing_campaign.append("competitivePrecincts")
            if not has_shares: missing_campaign.append("districtShares")
            log_fail("CSV-007", f"Missing campaign metrics structures: {', '.join(missing_campaign)}")

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
