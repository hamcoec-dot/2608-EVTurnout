// Hamilton County TN Turnout Report App Logic

// Register Chart.js DataLabels plugin globally
Chart.register(ChartDataLabels);

// Global Chart references for responsive resizing/destruction
var cumulativeChartRef = null;
var locationChartRef = null;
var partyDistributionChartRef = null;
var historicalPartyChartRef = null;
var partisanLocationChartRef = null;
var currentPartisanLocationMode = 'pct';
var ageChartRef = null;
var genderChartRef = null;
var districtChartRef = null;
var precinctChartRef = null;
var top10PrecinctChartRef = null;
var currentDistrictType = 'commission';
var currentPrecinctMode = 'count';
var currentTop10PrecinctMode = 'count';
var currentPrecinctSearchQuery = '';
var currentLocationMode = 'pct';
var currentAgeMode = 'pct';
var currentDistrictMode = 'pct';

// First-Time Hamilton County Voters Chart Refs & Modes
var ftPartyChartRef = null;
var ftSexChartRef = null;
var ftAgeChartRef = null;
var ftDailyTrendChartRef = null;
var ftLocationChartRef = null;
var ftDistrictChartRef = null;

// Top 5 Precinct Analytics Chart Refs & State
var top5LocationPrecinctChartRef = null;
var top5AgePrecinctChartRef = null;
var top5FTPrecinctChartRef = null;
var top5DistrictPrecinctChartRef = null;

var currentTop5LocLocation = 'ALL';
var currentTop5LocMode = 'count';

var currentTop5AgeBracket = 'ALL';
var currentTop5AgeMode = 'count';

var currentFTTop5PrecinctMode = 'count';

var currentTop5DistType = 'commission';
var currentTop5DistName = 'ALL';
var currentTop5DistMode = 'count';

var currentFTPartyMode = 'pct';
var currentFTSexMode = 'pct';
var currentFTAgeMode = 'pct';
var currentFTLocationMode = 'pct';
var currentFTDistrictView = 'commission';
var currentFTDistrictMode = 'pct';

// Initialization function run on body load
function initApp() {
  if (typeof TURNOUT_DATA === 'undefined') {
    console.error("TURNOUT_DATA is not defined. Make sure data.js is loaded.");
    return;
  }
  
  // Set report metadata
  document.getElementById("main-report-title").innerHTML = escapeHTML(TURNOUT_DATA.reportTitle);
  document.getElementById("sub-election-name").innerHTML = escapeHTML(TURNOUT_DATA.electionName);
  document.getElementById("sub-election-date").innerHTML = escapeHTML(TURNOUT_DATA.electionDate);
  if (TURNOUT_DATA.disclaimer) {
    document.getElementById("disclaimer-text").innerHTML = escapeHTML(TURNOUT_DATA.disclaimer);
  }

  // Render Stats with Animate value
  renderMetricStats();
  
  // Render Turnout Projection Card
  renderTurnoutProjection();
  
  // Render Party breakdown cards
  renderPartyCards();

  // Render First-Time Voters KPIs
  renderFirstTimeKpis();
  
  // Render Turnout Table
  renderTurnoutTable();
  
  // Render Comparison Table
  renderComparisonTable();
  
  // Populate Top 5 precinct select dropdowns
  populateTop5LocationSelectOptions();
  populateTop5DistrictSelectOptions();

  // Render Charts
  renderCharts();

  // Initialize active link highlight on scroll
  initTopNavScroll();

  // Initialize back to top floating button
  initBackToTopButton();
}

// Scroll to top of page smoothly
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show/hide floating back to top button on scroll
function initBackToTopButton() {
  var btn = document.getElementById('btn-back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });
}

// Scroll spy for sticky top navigation bar
function initTopNavScroll() {
  var links = document.querySelectorAll('.top-nav-link');
  var sections = document.querySelectorAll('[id^="section-"]');
  if (!links.length || !sections.length) return;

  function onScroll() {
    var scrollPos = window.scrollY + 120;
    sections.forEach(function(sec) {
      var top = sec.offsetTop;
      var height = sec.offsetHeight;
      var id = sec.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        links.forEach(function(link) {
          var href = link.getAttribute('href');
          link.classList.toggle('active', href === '#' + id);
        });
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

// Utility to escape HTML and prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

// Format numbers with commas (e.g., 3,898)
function formatNumber(n) {
  if (n === null || n === undefined) return '';
  if (typeof n === 'string') return n;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format percent with 2 decimal points
function formatPercent(val) {
  if (val === null || val === undefined) return '0.00%';
  return (val * 100).toFixed(2) + '%';
}

// Helper to calculate days of early voting remaining through the last day of early voting
function getDaysOfEarlyVotingRemaining() {
  if (!TURNOUT_DATA.earlyVotingEndDate) return 0;
  
  // Parse earlyVotingEndDate as a local date (avoiding UTC conversion shifts)
  var parts = TURNOUT_DATA.earlyVotingEndDate.split('-');
  var endDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // If today is before early voting starts, calculate from earlyVotingStartDate
  var startDate = today;
  if (TURNOUT_DATA.earlyVotingStartDate) {
    var sParts = TURNOUT_DATA.earlyVotingStartDate.split('-');
    var evStartDate = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
    if (today < evStartDate) {
      startDate = evStartDate;
    }
  }
  
  // Calculate inclusive day count from startDate through endDate
  var diffTime = endDate - startDate;
  var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Format today's date to YYYY-MM-DD
  var curY = now.getFullYear();
  var curM = String(now.getMonth() + 1).padStart(2, '0');
  var curD = String(now.getDate()).padStart(2, '0');
  var todayStr = curY + '-' + curM + '-' + curD;
  
  // Check if today has turnout results loaded
  var hasTodayResults = false;
  if (TURNOUT_DATA.dailyTurnout) {
    for (var i = 0; i < TURNOUT_DATA.dailyTurnout.length; i++) {
      var entry = TURNOUT_DATA.dailyTurnout[i];
      if (entry.date === todayStr && entry.total > 0) {
        hasTodayResults = true;
        break;
      }
    }
  }
  
  if (hasTodayResults) {
    diffDays -= 1;
  }
  
  return diffDays > 0 ? diffDays : 0;
}

// Smooth number counter using requestAnimationFrame
function animateValue(id, start, end, duration, isPercent) {
  var obj = document.getElementById(id);
  if (!obj) return;
  
  var startTimestamp = null;
  var step = function(timestamp) {
    if (!startTimestamp) startTimestamp = timestamp;
    var progress = Math.min((timestamp - startTimestamp) / duration, 1);
    var currentVal = progress * (end - start) + start;
    
    if (isPercent) {
      obj.innerHTML = formatPercent(currentVal);
    } else {
      obj.innerHTML = formatNumber(Math.floor(currentVal));
    }
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      // Set exact final value
      if (isPercent) {
        obj.innerHTML = formatPercent(end);
      } else {
        obj.innerHTML = formatNumber(end);
      }
    }
  };
  window.requestAnimationFrame(step);
}

// Render Metric Stats
function renderMetricStats() {
  var summary = TURNOUT_DATA.summary;
  animateValue("stat-grand-total", 0, summary.grandTotal, 1000, false);
  animateValue("stat-registered", 0, summary.totalRegistered, 1000, false);
  animateValue("stat-percent", 0, summary.turnoutPercent, 1000, true);
  
  var daysLeft = getDaysOfEarlyVotingRemaining();
  animateValue("stat-days-left", 0, daysLeft, 800, false);

  if (TURNOUT_DATA.firstTimeVoters) {
    var ft = TURNOUT_DATA.firstTimeVoters;
    animateValue("stat-first-time-total", 0, ft.total, 1000, false);
    var ftPctEl = document.getElementById("stat-first-time-pct");
    if (ftPctEl) {
      ftPctEl.innerText = ft.turnoutPercent.toFixed(2) + "% of turnout";
    }
  }
}

// Render First-Time Hamilton County Voters KPI section cards
function renderFirstTimeKpis() {
  if (!TURNOUT_DATA.firstTimeVoters) return;
  var ft = TURNOUT_DATA.firstTimeVoters;

  // KPI 1: Total & % Turnout Share
  animateValue("ft-kpi-total", 0, ft.total, 1000, false);
  var turnoutShareEl = document.getElementById("ft-kpi-turnout-share");
  if (turnoutShareEl) {
    turnoutShareEl.innerText = ft.turnoutPercent.toFixed(2) + "% of total turnout";
  }

  // KPI 2: Partisan Split
  var pb = ft.partyBreakdown || {};
  var demCount = pb.democrat || 0;
  var repCount = pb.republican || 0;
  var totalParty = demCount + repCount + (pb.general || 0);
  var demPct = totalParty > 0 ? (demCount / totalParty * 100).toFixed(1) : "0.0";
  var repPct = totalParty > 0 ? (repCount / totalParty * 100).toFixed(1) : "0.0";

  var splitEl = document.getElementById("ft-kpi-party-split");
  if (splitEl) {
    splitEl.innerText = demPct + "% D / " + repPct + "% R";
  }
  var leadEl = document.getElementById("ft-kpi-leading-party");
  if (leadEl) {
    var diff = demCount - repCount;
    if (diff > 0) {
      leadEl.innerText = "Democrat Lead (+" + diff + " voters)";
      leadEl.style.color = "#1976D2";
    } else if (diff < 0) {
      leadEl.innerText = "Republican Lead (+" + Math.abs(diff) + " voters)";
      leadEl.style.color = "#D32F2F";
    } else {
      leadEl.innerText = "Tied Partisan Participation";
      leadEl.style.color = "var(--text-secondary)";
    }
  }

  // KPI 3: Top Age Cohort
  var ageGroups = ft.ageGroups || {};
  var topAgeBracket = "";
  var maxAgeCount = 0;
  for (var bracket in ageGroups) {
    if (ageGroups[bracket].total > maxAgeCount) {
      maxAgeCount = ageGroups[bracket].total;
      topAgeBracket = bracket;
    }
  }
  var topAgeEl = document.getElementById("ft-kpi-top-age");
  if (topAgeEl) {
    topAgeEl.innerText = topAgeBracket || "18-29";
  }
  var youthShareEl = document.getElementById("ft-kpi-youth-share");
  if (youthShareEl && ft.total > 0) {
    var youthPct = (maxAgeCount / ft.total * 100).toFixed(1);
    youthShareEl.innerText = youthPct + "% of first-time voters";
  }

  // KPI 4: Top Location
  var locs = ft.locations || {};
  var topLocName = "";
  var maxLocCount = 0;
  for (var locName in locs) {
    if (locs[locName] > maxLocCount) {
      maxLocCount = locs[locName];
      topLocName = locName;
    }
  }
  var topLocEl = document.getElementById("ft-kpi-top-location");
  if (topLocEl) {
    topLocEl.innerText = topLocName || "Election Comm.";
  }
  var locCountEl = document.getElementById("ft-kpi-location-count");
  if (locCountEl) {
    locCountEl.innerText = formatNumber(maxLocCount) + " voters";
  }
}

// Render Party overview cards
function renderPartyCards() {
  var pt = TURNOUT_DATA.partyTotals;
  var sum = TURNOUT_DATA.summary.grandTotal || 1;
  
  var repPct = pt.republican / sum;
  var demPct = pt.democrat / sum;
  var genPct = pt.general / sum;
  
  animateValue("rep-count", 0, pt.republican, 1000, false);
  document.getElementById("rep-pct").innerHTML = (repPct * 100).toFixed(1) + '%';
  document.getElementById("rep-progress").style.width = (repPct * 100) + '%';
  
  animateValue("dem-count", 0, pt.democrat, 1000, false);
  document.getElementById("dem-pct").innerHTML = (demPct * 100).toFixed(1) + '%';
  document.getElementById("dem-progress").style.width = (demPct * 100) + '%';
  
  animateValue("gen-count", 0, pt.general, 1000, false);
  document.getElementById("gen-pct").innerHTML = (genPct * 100).toFixed(1) + '%';
  document.getElementById("gen-progress").style.width = (genPct * 100) + '%';
}

// Render Turnout Table
function renderTurnoutTable() {
  var headerRow = document.getElementById("table-headers");
  var tbody = document.getElementById("table-body");
  
  // Clear dynamic elements
  while (headerRow.children.length > 1) {
    headerRow.removeChild(headerRow.lastChild);
  }
  tbody.innerHTML = "";
  
  // Add location headers
  var locations = TURNOUT_DATA.locations;
  for (var i = 0; i < locations.length; i++) {
    var th = document.createElement("th");
    th.setAttribute("scope", "col");
    th.innerHTML = escapeHTML(locations[i]);
    headerRow.appendChild(th);
  }
  
  // Add Total header
  var thTotal = document.createElement("th");
  thTotal.setAttribute("scope", "col");
  thTotal.innerHTML = "Totals";
  headerRow.appendChild(thTotal);
  
  // Add daily rows
  var daily = TURNOUT_DATA.dailyTurnout;
  for (var r = 0; r < daily.length; r++) {
    var entry = daily[r];
    var tr = document.createElement("tr");
    tr.id = "row-" + r;
    
    // Date column (sticky)
    var tdDate = document.createElement("td");
    tdDate.className = "sticky-col text-nowrap";
    
    // Check if we have CSV party data to allow expandable rows
    if (entry.partyBreakdown) {
      var btn = document.createElement("button");
      btn.setAttribute("type", "button");
      btn.className = "detail-toggle-btn";
      btn.id = "toggle-btn-" + r;
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Show party breakdown details for date " + entry.date);
      btn.setAttribute("onclick", "toggleRowDetails(" + r + ")");
      btn.setAttribute("onkeydown", "handleRowKey(event, " + r + ")");
      btn.innerHTML = "<span class=\"detail-arrow\" id=\"arrow-" + r + "\" aria-hidden=\"true\">&#x25B8;</span> " + formatLabelDate(entry.date);
      tdDate.appendChild(btn);
    } else {
      tdDate.innerHTML = formatLabelDate(entry.date);
    }
    tr.appendChild(tdDate);
    
    // Values columns
    for (var c = 0; c < locations.length; c++) {
      var loc = locations[c];
      var val = entry.values[loc];
      var td = document.createElement("td");
      
      if (val === null || val === undefined) {
        td.innerHTML = "<span class=\"na-badge\">N/A</span>";
      } else if (val === 0) {
        td.innerHTML = "&#x2014;"; // Em-dash ASCII entity
      } else {
        td.innerHTML = formatNumber(val);
      }
      tr.appendChild(td);
    }
    
    // Row Total column
    var tdTotal = document.createElement("td");
    tdTotal.innerHTML = "<strong>" + formatNumber(entry.total) + "</strong>";
    tr.appendChild(tdTotal);
    tbody.appendChild(tr);
    
    // Append expandable sub-row if party breakdown data is available
    if (entry.partyBreakdown) {
      appendDetailsSubrow(tbody, r, entry);
    }
  }
  
  // Append Totals row at the very bottom
  var trTotals = document.createElement("tr");
  trTotals.className = "totals-row";
  
  var tdLabel = document.createElement("td");
  tdLabel.className = "sticky-col";
  tdLabel.innerHTML = "<strong>Totals</strong>";
  trTotals.appendChild(tdLabel);
  
  for (var c = 0; c < locations.length; c++) {
    var loc = locations[c];
    var val = TURNOUT_DATA.totals[loc];
    var td = document.createElement("td");
    td.innerHTML = "<strong>" + formatNumber(val) + "</strong>";
    trTotals.appendChild(td);
  }
  
  var tdGrand = document.createElement("td");
  tdGrand.innerHTML = "<strong>" + formatNumber(TURNOUT_DATA.totals.total) + "</strong>";
  trTotals.appendChild(tdGrand);
  tbody.appendChild(trTotals);
}

// Date formatting helper for labels
function formatLabelDate(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[d.getDay()] + ", " + months[d.getMonth()] + "&nbsp;" + d.getDate();
  }
  return dateStr.replace(/\s/g, "&nbsp;");
}

// Append detail table sub-row
function appendDetailsSubrow(tbody, rIdx, entry) {
  var trDetail = document.createElement("tr");
  trDetail.className = "details-row";
  trDetail.id = "details-row-" + rIdx;
  trDetail.style.display = "none";
  
  var colSpanVal = TURNOUT_DATA.locations.length + 2;
  var td = document.createElement("td");
  td.setAttribute("colspan", colSpanVal);
  
  var wrapper = document.createElement("div");
  wrapper.className = "details-wrapper";
  wrapper.id = "wrapper-" + rIdx;
  
  var container = document.createElement("div");
  container.className = "details-container";
  container.innerHTML = "<h4>Party Turnout Details: " + escapeHTML(entry.date) + "</h4>";
  
  var table = document.createElement("table");
  table.className = "mini-details-table";
  table.innerHTML = "<thead>" +
    "<tr>" +
      "<th scope=\"col\">Voting Location</th>" +
      "<th scope=\"col\">Total Voters</th>" +
      "<th scope=\"col\">Democrat</th>" +
      "<th scope=\"col\">Republican</th>" +
      "<th scope=\"col\">General</th>" +
      "<th scope=\"col\">Distribution Share</th>" +
    "</tr>" +
  "</thead>";
  
  var tBodyMini = document.createElement("tbody");
  var pb = entry.partyBreakdown;
  
  for (var loc in pb) {
    if (pb.hasOwnProperty(loc)) {
      var item = pb[loc];
      var trMini = document.createElement("tr");
      
      var shareBar = "";
      if (item.total > 0) {
        var dPct = Math.round(item.democrat / item.total * 100);
        var rPct = Math.round(item.republican / item.total * 100);
        var gPct = Math.round(item.general / item.total * 100);
        
        // Adjust round-off errors to sum to exactly 100
        var diff = 100 - (dPct + rPct + gPct);
        if (diff !== 0) {
          if (dPct >= rPct && dPct >= gPct) dPct += diff;
          else if (rPct >= dPct && rPct >= gPct) rPct += diff;
          else gPct += diff;
        }
        
        var dText = dPct >= 15 ? dPct + "%" : "";
        var rText = rPct >= 15 ? rPct + "%" : "";
        var gText = gPct >= 15 ? gPct + "%" : "";
        
        shareBar = "<div class=\"share-cell-content\">" +
          "<div class=\"share-text-legend\">" +
            "<span class=\"share-legend-item\"><span class=\"legend-dot\" style=\"background-color: var(--blue-muted);\"></span>D: " + dPct + "%</span>" +
            "<span class=\"share-legend-item\"><span class=\"legend-dot\" style=\"background-color: var(--red-muted);\"></span>R: " + rPct + "%</span>" +
            "<span class=\"share-legend-item\"><span class=\"legend-dot\" style=\"background-color: var(--gold);\"></span>G: " + gPct + "%</span>" +
          "</div>" +
          "<div class=\"stacked-bar-container\">" +
            "<div class=\"stacked-bar-segment\" style=\"width:" + dPct + "%; background-color: var(--blue-muted);\" title=\"Democrat: " + dPct + "%\">" + dText + "</div>" +
            "<div class=\"stacked-bar-segment\" style=\"width:" + rPct + "%; background-color: var(--red-muted);\" title=\"Republican: " + rPct + "%\">" + rText + "</div>" +
            "<div class=\"stacked-bar-segment gen-seg\" style=\"width:" + gPct + "%; background-color: var(--gold);\" title=\"General: " + gPct + "%\">" + gText + "</div>" +
          "</div>" +
        "</div>";
      } else {
        shareBar = "<div style=\"color: var(--text-secondary);\">No votes</div>";
      }
      
      trMini.innerHTML = "<td>" + escapeHTML(loc) + "</td>" +
        "<td>" + formatNumber(item.total) + "</td>" +
        "<td>" + formatNumber(item.democrat) + "</td>" +
        "<td>" + formatNumber(item.republican) + "</td>" +
        "<td>" + formatNumber(item.general) + "</td>" +
        "<td>" + shareBar + "</td>";
        
      tBodyMini.appendChild(trMini);
    }
  }
  table.appendChild(tBodyMini);
  container.appendChild(table);
  wrapper.appendChild(container);
  td.appendChild(wrapper);
  trDetail.appendChild(td);
  tbody.appendChild(trDetail);
}

// Toggle row detail expand/collapse
function toggleRowDetails(rIdx) {
  var row = document.getElementById("details-row-" + rIdx);
  var wrapper = document.getElementById("wrapper-" + rIdx);
  var btn = document.getElementById("toggle-btn-" + rIdx);
  var arrow = document.getElementById("arrow-" + rIdx);
  
  if (!row || !wrapper || !btn || !arrow) return;
  
  var isExpanded = btn.getAttribute("aria-expanded") === "true";
  
  if (isExpanded) {
    btn.setAttribute("aria-expanded", "false");
    arrow.classList.remove("rotated");
    wrapper.classList.remove("expanded");
    setTimeout(function() {
      if (btn.getAttribute("aria-expanded") === "false") {
        row.style.display = "none";
      }
    }, 300);
  } else {
    row.style.display = "table-row";
    btn.setAttribute("aria-expanded", "true");
    arrow.classList.add("rotated");
    setTimeout(function() {
      wrapper.classList.add("expanded");
    }, 10);
  }
}

// Key listener to collapse on Escape press
function handleRowKey(event, rIdx) {
  if (event.key === "Escape" || event.keyCode === 27) {
    var btn = document.getElementById("toggle-btn-" + rIdx);
    if (btn && btn.getAttribute("aria-expanded") === "true") {
      toggleRowDetails(rIdx);
      btn.focus();
      event.preventDefault();
    }
  }
}

// Render Comparison Table
function renderComparisonTable() {
  var tbody = document.getElementById("comparison-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  // Current Election row
  var curSum = TURNOUT_DATA.summary;
  var curParty = TURNOUT_DATA.partyTotals;
  var curRepShare = (curParty.republican / curSum.grandTotal * 100).toFixed(1) + '%';
  var curDemShare = (curParty.democrat / curSum.grandTotal * 100).toFixed(1) + '%';
  var curGenShare = (curParty.general / curSum.grandTotal * 100).toFixed(1) + '%';
  
  var trCur = document.createElement("tr");
  trCur.className = "current-election-row";
  trCur.innerHTML = "<td class=\"sticky-col\"><strong>2026 (Current)</strong></td>" +
    "<td>" + formatNumber(curSum.earlyVoting) + "</td>" +
    "<td>" + formatNumber(curSum.absenteeNH) + "</td>" +
    "<td><strong>" + formatNumber(curSum.grandTotal) + "</strong></td>" +
    "<td>" + formatNumber(curSum.totalRegistered) + "</td>" +
    "<td><strong>" + formatPercent(curSum.turnoutPercent) + "</strong></td>" +
    "<td>" + curRepShare + "</td>" +
    "<td>" + curDemShare + "</td>" +
    "<td>" + curGenShare + "</td>";
  tbody.appendChild(trCur);
  
  // Sort historical years in descending order
  var hist = TURNOUT_DATA.historical;
  if (hist) {
    var years = Object.keys(hist).sort(function(a, b) { return b - a; });
    for (var i = 0; i < years.length; i++) {
      var y = years[i];
      var data = hist[y];
      var s = data.summary;
      var sum = s.grandTotal || 1;
      
      var repShare = (s.republican / sum * 100).toFixed(1) + '%';
      var demShare = (s.democrat / sum * 100).toFixed(1) + '%';
      var genShare = (s.general / sum * 100).toFixed(1) + '%';
      
      // Early Voting is Grand Total - Absentee
      // For 2018, there is no separate absentee count parsed directly, so we can display Grand Total and use placeholders or deduct if we have it
      // 2024 absentee total = 1885
      // 2022 absentee total = 2164
      // 2018 absentee total = 346 (pre-EV mail total)
      var abs = 0;
      if (y === "2024") abs = 1885;
      else if (y === "2022") abs = 2164;
      else if (y === "2020") abs = 8276;
      else if (y === "2018") abs = 346;
      
      var ev = s.grandTotal - abs;
      
      var trHist = document.createElement("tr");
      trHist.innerHTML = "<td class=\"sticky-col\">August " + y + "</td>" +
        "<td>" + formatNumber(ev) + "</td>" +
        "<td>" + formatNumber(abs) + "</td>" +
        "<td><strong>" + formatNumber(s.grandTotal) + "</strong></td>" +
        "<td>" + formatNumber(s.registered) + "</td>" +
        "<td><strong>" + formatPercent(s.turnoutPercent) + "</strong></td>" +
        "<td>" + repShare + "</td>" +
        "<td>" + demShare + "</td>" +
        "<td>" + genShare + "</td>";
      tbody.appendChild(trHist);
    }
  }
}

// Generate properly escaped CSV representation from dataset
function exportToCSV() {
  var csvLines = [];
  
  var headers = ["Date", "Location", "TotalVoters", "DEMOCRAT", "REPUBLICAN", "GENERAL"];
  csvLines.push(headers.join(","));
  
  var daily = TURNOUT_DATA.dailyTurnout;
  for (var i = 0; i < daily.length; i++) {
    var entry = daily[i];
    
    if (entry.partyBreakdown) {
      for (var loc in entry.partyBreakdown) {
        if (entry.partyBreakdown.hasOwnProperty(loc)) {
          var pb = entry.partyBreakdown[loc];
          var row = [
            escapeCSV(entry.date),
            escapeCSV(loc),
            pb.total,
            pb.democrat,
            pb.republican,
            pb.general
          ];
          csvLines.push(row.join(","));
        }
      }
    } else {
      var locs = TURNOUT_DATA.locations;
      for (var j = 0; j < locs.length; j++) {
        var lName = locs[j];
        var val = entry.values[lName];
        if (val !== null && val !== undefined) {
          var row = [
            escapeCSV(entry.date),
            escapeCSV(lName),
            val,
            "",
            "",
            ""
          ];
          csvLines.push(row.join(","));
        }
      }
    }
  }
  
  var csvContent = csvLines.join("\n");
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Early_Voting_Turnout_Report_" + new Date().toISOString().slice(0,10) + ".csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CSV escaping utility
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  var str = val.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Render Chart.js data visualizations
function renderCharts() {
  if (cumulativeChartRef) cumulativeChartRef.destroy();
  if (locationChartRef) locationChartRef.destroy();
  if (partyDistributionChartRef) partyDistributionChartRef.destroy();
  if (historicalPartyChartRef) historicalPartyChartRef.destroy();
  if (partisanLocationChartRef) partisanLocationChartRef.destroy();
  if (ageChartRef) ageChartRef.destroy();
  if (genderChartRef) genderChartRef.destroy();
  if (districtChartRef) districtChartRef.destroy();
  if (precinctChartRef) precinctChartRef.destroy();
  if (top10PrecinctChartRef) top10PrecinctChartRef.destroy();
  if (top5LocationPrecinctChartRef) top5LocationPrecinctChartRef.destroy();
  if (top5AgePrecinctChartRef) top5AgePrecinctChartRef.destroy();
  if (top5FTPrecinctChartRef) top5FTPrecinctChartRef.destroy();
  if (top5DistrictPrecinctChartRef) top5DistrictPrecinctChartRef.destroy();

  renderFirstTimeCharts();
  renderDemographicCharts();
  renderTop5LocationPrecinctChart();
  
  var daily = TURNOUT_DATA.dailyTurnout;
  
  // 1. Plot cumulative lines (2026 vs past cycles)
  var X_labels = ["Pre-EV", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Day 11", "Day 12", "Day 13", "Day 14", "Day 15"];
  
  // Current cumulative totals slice up to the last active date
  var curCumulative = [];
  var curSum = 0;
  
  var lastActiveIndex = 0;
  for (var i = 0; i < daily.length; i++) {
    // Only slice up to rows with data, excluding future rows
    if (daily[i].total > 0 && daily[i].date !== "8/2/26-Election Day") {
      lastActiveIndex = i;
    }
  }
  for (var i = 0; i < daily.length; i++) {
    if (i <= lastActiveIndex) {
      curSum += daily[i].total;
      curCumulative.push(curSum);
    } else {
      curCumulative.push(null); // Leave remaining points as null to stop line render
    }
  }
  
  // Load historical arrays
  var y2024 = [];
  var y2022 = [];
  var y2020 = [];
  var y2018 = [];
  
  var hist = TURNOUT_DATA.historical;
  if (hist) {
    if (hist["2024"]) y2024 = hist["2024"].cumulativeTotals;
    if (hist["2022"]) y2022 = hist["2022"].cumulativeTotals;
    if (hist["2020"]) y2020 = hist["2020"].cumulativeTotals;
    if (hist["2018"]) y2018 = hist["2018"].cumulativeTotals;
  }
  
  var datasets = [
    {
      label: '2026 (Current)',
      data: curCumulative,
      borderColor: '#1B2A4A',
      backgroundColor: 'rgba(27, 42, 74, 0.12)',
      borderWidth: 4,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointBackgroundColor: '#1B2A4A',
      tension: 0.15,
      fill: false
    }
  ];
  
  if (y2024.length > 0) {
    datasets.push({
      label: '2024 Election',
      data: y2024,
      borderColor: '#3B6FA0',
      borderWidth: 3,
      borderDash: [6, 4],
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: '#3B6FA0',
      tension: 0.15,
      fill: false
    });
  }
  
  if (y2022.length > 0) {
    datasets.push({
      label: '2022 Election',
      data: y2022,
      borderColor: '#C4483E',
      borderWidth: 3,
      borderDash: [4, 4],
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: '#C4483E',
      tension: 0.15,
      fill: false
    });
  }

  if (y2020.length > 0) {
    datasets.push({
      label: '2020 Election',
      data: y2020,
      borderColor: '#7E57C2',
      borderWidth: 3,
      borderDash: [5, 5],
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: '#7E57C2',
      tension: 0.15,
      fill: false
    });
  }
  
  if (y2018.length > 0) {
    datasets.push({
      label: '2018 Election',
      data: y2018,
      borderColor: '#D4A843',
      borderWidth: 3,
      borderDash: [2, 2],
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: '#D4A843',
      tension: 0.15,
      fill: false
    });
  }
  
  var ctx1 = document.getElementById('cumulativeChart');
  if (ctx1) {
    cumulativeChartRef = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: X_labels.slice(0, Math.max(curCumulative.length, y2024.length, y2022.length, y2020.length, y2018.length)),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 22,
              usePointStyle: true,
              padding: 20,
              font: { size: 14, weight: '600' }
            }
          },
          tooltip: {
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                var label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toLocaleString() + ' votes';
                }
                return label;
              }
            }
          },
          datalabels: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#E2E8F0' },
            ticks: {
              font: { size: 12 },
              callback: function(value) { return value.toLocaleString(); }
            },
            title: {
              display: true,
              text: 'Total Cumulative Votes Cast',
              font: { size: 14, weight: 'bold' },
              padding: { bottom: 10 }
            }
          },
          x: {
            grid: { color: '#F1F5F9' },
            ticks: { font: { size: 12 } },
            title: {
              display: true,
              text: 'Early Voting Day Timeline',
              font: { size: 14, weight: 'bold' },
              padding: { top: 10 }
            }
          }
        }
      }
    });
  }
  
  // 2. Turnout by location horizontal bar chart
  renderLocationChart();
  
  // 3. Primary election distribution donut chart
  var pt = TURNOUT_DATA.partyTotals;
  var ctx3 = document.getElementById('partyDistributionChart');
  if (ctx3) {
    partyDistributionChartRef = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: ['Republican Primary', 'Democrat Primary', 'General Election'],
        datasets: [{
          data: [pt.republican, pt.democrat, pt.general],
          backgroundColor: ['#C4483E', '#3B6FA0', '#D4A843'],
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 12 }
            }
          },
          datalabels: {
            display: true,
            color: function(ctx) {
              return ctx.dataIndex === 2 ? '#1B2A4A' : '#FFFFFF';
            },
            font: { weight: 'bold', size: 11 },
            formatter: function(value, ctx) {
              var sum = 0;
              var dataArr = ctx.chart.data.datasets[0].data;
              dataArr.map(function(data) { sum += data; });
              var percentage = (value * 100 / sum).toFixed(1) + "%";
              return value > 0 ? percentage : '';
            }
          }
        },
        cutout: '65%'
      }
    });
  }
  
  // 4. Partisan Primary Share by Location stacked bar chart
  renderPartisanLocationChart();
  
  // 5. Historical Partisan Primary Share Trend stacked bar chart
  renderHistoricalPartyTrendChart();
}

// Render Turnout Projection Card
function renderTurnoutProjection() {
  var rangeEl = document.getElementById("stat-projected-range");
  var pctEl = document.getElementById("stat-projected-pct");
  if (!rangeEl) return;

  var daily = TURNOUT_DATA.dailyTurnout;
  var hist = TURNOUT_DATA.historical;
  if (!daily || !hist) {
    rangeEl.innerHTML = "TBD";
    return;
  }

  // 1. Find the current active early voting day index (D)
  var lastActiveIndex = -1;
  var curCumulative = 0;
  for (var i = 0; i < daily.length; i++) {
    // Only count dates with totals, up to the day before Election Day
    if (daily[i].total > 0 && daily[i].date.indexOf("Election Day") === -1) {
      lastActiveIndex = i;
      curCumulative += daily[i].total;
    }
  }

  if (lastActiveIndex < 0) {
    rangeEl.innerHTML = "TBD";
    if (pctEl) pctEl.innerHTML = "Waiting for early voting to start";
    return;
  }

  // 2. Loop through historical years and compute projections
  var projections = [];
  var years = Object.keys(hist);
  for (var i = 0; i < years.length; i++) {
    var yr = years[i];
    var hData = hist[yr];
    if (hData.cumulativeTotals && lastActiveIndex < hData.cumulativeTotals.length) {
      var histCum = hData.cumulativeTotals[lastActiveIndex];
      var histGrandTotal = hData.summary.grandTotal;
      if (histCum > 0 && histGrandTotal > 0) {
        var ratio = histCum / histGrandTotal;
        var proj = curCumulative / ratio;
        projections.push(proj);
      }
    }
  }

  if (projections.length === 0) {
    rangeEl.innerHTML = "TBD";
    if (pctEl) pctEl.innerHTML = "No historical curve match";
    return;
  }

  // 3. Find the projection range
  var minProj = Math.min.apply(null, projections);
  var maxProj = Math.max.apply(null, projections);

  // Round to nearest 50
  var minProjRounded = Math.round(minProj / 50) * 50;
  var maxProjRounded = Math.round(maxProj / 50) * 50;

  // Format with commas
  var rangeText = formatNumber(minProjRounded) + " - " + formatNumber(maxProjRounded);
  rangeEl.innerHTML = rangeText;

  // Percentage Range calculation
  if (pctEl) {
    var regVoters = TURNOUT_DATA.summary.totalRegistered || 218764;
    var minPct = (minProjRounded / regVoters * 100).toFixed(2) + "%";
    var maxPct = (maxProjRounded / regVoters * 100).toFixed(2) + "%";
    pctEl.innerHTML = minPct + " - " + maxPct + " of registered";
  }
}

// Render Historical Partisan Primary Ballot Share Trend Stacked Bar Chart
function renderHistoricalPartyTrendChart() {
  var ctx = document.getElementById('historicalPartyChart');
  if (!ctx) return;

  var labels = [];
  var gopData = [];
  var demData = [];
  var genData = [];

  var hist = TURNOUT_DATA.historical;
  if (hist) {
    // Sort years ascending: 2018, 2020, 2022, 2024
    var years = Object.keys(hist).sort(function(a, b) { return a - b; });
    for (var i = 0; i < years.length; i++) {
      var yr = years[i];
      var s = hist[yr].summary;
      var tot = s.grandTotal || 1;
      labels.push("August " + yr);
      gopData.push(parseFloat((s.republican / tot * 100).toFixed(1)));
      demData.push(parseFloat((s.democrat / tot * 100).toFixed(1)));
      genData.push(parseFloat((s.general / tot * 100).toFixed(1)));
    }
  }

  // Appending current year (2026) dynamically if party details are loaded
  var curSum = TURNOUT_DATA.summary.grandTotal || 1;
  var curParty = TURNOUT_DATA.partyTotals;
  if (curParty && curParty.total > 0) {
    labels.push("August 2026 (Cur.)");
    gopData.push(parseFloat((curParty.republican / curSum * 100).toFixed(1)));
    demData.push(parseFloat((curParty.democrat / curSum * 100).toFixed(1)));
    genData.push(parseFloat((curParty.general / curSum * 100).toFixed(1)));
  }

  historicalPartyChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Republican',
          data: gopData,
          backgroundColor: '#C4483E',
          borderColor: '#B33E35',
          borderWidth: 1
        },
        {
          label: 'Democrat',
          data: demData,
          backgroundColor: '#3B6FA0',
          borderColor: '#325E88',
          borderWidth: 1
        },
        {
          label: 'General Election Only',
          data: genData,
          backgroundColor: '#D4A843',
          borderColor: '#C39A3C',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + "%";
            }
          },
          grid: { color: '#E2E8F0' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        datalabels: {
          display: true,
          color: function(context) {
            // Dark text for General Only (gold background) for contrast, white for others
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 10 },
          formatter: function(value) {
            return value > 4 ? value + '%' : ''; // Only show text if label space permits
          }
        }
      }
    }
  });
}

// Toggle view mode between Percentage Share and Vote Count for Turnout by Location chart
function setLocationMode(mode) {
  currentLocationMode = mode;
  var btnPct = document.getElementById('btn-loc-pct');
  var btnCount = document.getElementById('btn-loc-count');
  if (btnPct && btnCount) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderLocationChart();
}

// Render Turnout by Location horizontal bar chart
function renderLocationChart() {
  if (locationChartRef) {
    locationChartRef.destroy();
    locationChartRef = null;
  }
  
  var ctx2 = document.getElementById('locationChart');
  if (!ctx2) return;

  var locLabels = [];
  var locValues = [];
  var isLocPct = (currentLocationMode === 'pct');
  var grandTot = (TURNOUT_DATA.summary && TURNOUT_DATA.summary.grandTotal) ? TURNOUT_DATA.summary.grandTotal : 1;

  var locations = TURNOUT_DATA.locations || [];
  for (var j = 0; j < locations.length; j++) {
    var lName = locations[j];
    locLabels.push(lName);
    var cnt = (TURNOUT_DATA.totals && TURNOUT_DATA.totals[lName]) ? TURNOUT_DATA.totals[lName] : 0;
    if (isLocPct) {
      locValues.push(parseFloat(((cnt / grandTot) * 100).toFixed(1)));
    } else {
      locValues.push(cnt);
    }
  }
  
  locationChartRef = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: locLabels,
      datasets: [{
        label: isLocPct ? '% Share of Total Turnout' : 'Total Voters',
        data: locValues,
        backgroundColor: '#D4A843',
        borderRadius: 6,
        barPercentage: 0.75,
        categoryPercentage: 0.85
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              return isLocPct ? ('% Share: ' + val + '%') : ('Voters: ' + formatNumber(val));
            }
          }
        },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'end',
          color: '#1B2A4A',
          font: { weight: 'bold', size: 11 },
          formatter: function(value) {
            if (isLocPct) {
              return value > 0 ? value.toFixed(1) + '%' : '';
            } else {
              return value > 0 ? formatNumber(value) : '';
            }
          }
        }
      },
      scales: {
        x: {
          grace: '15%',
          beginAtZero: true,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isLocPct ? '% Share of Total Turnout' : 'Voter Count', font: { size: 12, weight: 'bold' } }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 12, weight: '600' }, color: '#1B2A4A' }
        }
      }
    }
  });
}

// Toggle view mode between Percentage Share and Vote Count for Partisan Location chart
function setPartisanLocationMode(mode) {
  currentPartisanLocationMode = mode;
  var btnPct = document.getElementById('btn-part-loc-pct');
  var btnCount = document.getElementById('btn-part-loc-count');
  if (btnPct && btnCount) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderPartisanLocationChart();
}

// Render Partisan Primary Share by Location Stacked Bar Chart
function renderPartisanLocationChart() {
  if (partisanLocationChartRef) {
    partisanLocationChartRef.destroy();
    partisanLocationChartRef = null;
  }
  
  var ctx = document.getElementById('partisanLocationChart');
  if (!ctx) return;
  
  var locations = TURNOUT_DATA.locations || [];
  var locPartyData = {};
  for (var i = 0; i < locations.length; i++) {
    locPartyData[locations[i]] = { democrat: 0, republican: 0, general: 0, total: 0 };
  }
  
  var daily = TURNOUT_DATA.dailyTurnout || [];
  for (var d = 0; d < daily.length; d++) {
    var pb = daily[d].partyBreakdown;
    if (pb) {
      for (var loc in pb) {
        if (pb.hasOwnProperty(loc) && locPartyData[loc]) {
          locPartyData[loc].democrat += (pb[loc].democrat || 0);
          locPartyData[loc].republican += (pb[loc].republican || 0);
          locPartyData[loc].general += (pb[loc].general || 0);
          locPartyData[loc].total += (pb[loc].total || 0);
        }
      }
    }
  }
  
  var labels = [];
  var repData = [];
  var demData = [];
  var genData = [];
  
  var isPctMode = (currentPartisanLocationMode === 'pct');
  
  for (var j = 0; j < locations.length; j++) {
    var lName = locations[j];
    labels.push(lName);
    var item = locPartyData[lName] || { democrat: 0, republican: 0, general: 0, total: 0 };
    var tot = item.democrat + item.republican + item.general;
    
    if (isPctMode) {
      if (tot > 0) {
        repData.push(parseFloat(((item.republican / tot) * 100).toFixed(1)));
        demData.push(parseFloat(((item.democrat / tot) * 100).toFixed(1)));
        genData.push(parseFloat(((item.general / tot) * 100).toFixed(1)));
      } else {
        repData.push(0);
        demData.push(0);
        genData.push(0);
      }
    } else {
      repData.push(item.republican);
      demData.push(item.democrat);
      genData.push(item.general);
    }
  }
  
  partisanLocationChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Republican',
          data: repData,
          backgroundColor: '#C0392B',
          borderRadius: 4
        },
        {
          label: 'Democrat',
          data: demData,
          backgroundColor: '#2980B9',
          borderRadius: 4
        },
        {
          label: 'General',
          data: genData,
          backgroundColor: '#D4A843',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: {
            display: true,
            text: isPctMode ? 'Primary Ballot Share (%)' : 'Ballot Count'
          }
        },
        y: {
          stacked: true,
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              var label = context.dataset.label || '';
              if (isPctMode) {
                return label + ': ' + val + '%';
              } else {
                return label + ': ' + formatNumber(val) + ' voters';
              }
            }
          }
        },
        datalabels: {
          display: function(context) {
            var val = context.dataset.data[context.dataIndex];
            return isPctMode ? (val > 4) : (val > 30);
          },
          color: function(context) {
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 10 },
          formatter: function(value) {
            if (isPctMode) {
              return value.toFixed(1) + '%';
            } else {
              return formatNumber(value);
            }
          }
        }
      }
    }
  });
}

// District View Switcher Handler
function setDistrictView(districtType) {
  currentDistrictType = districtType;

  var types = ['commission', 'senate', 'house', 'school', 'city'];
  for (var i = 0; i < types.length; i++) {
    var btn = document.getElementById('btn-dist-' + types[i]);
    if (btn) {
      if (types[i] === districtType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  renderDistrictChart();
}

function renderDemographicCharts() {
  if (!TURNOUT_DATA || !TURNOUT_DATA.demographics) return;

  renderAgeChart();
  renderTop5AgePrecinctChart();
  renderGenderChart();
  renderDistrictChart();
  renderTop5DistrictPrecinctChart();
  renderTop10PrecinctChart();
  renderPrecinctChart();
}

function setAgeMode(mode) {
  currentAgeMode = mode;
  var btnPct = document.getElementById('btn-age-pct');
  var btnCount = document.getElementById('btn-age-count');
  if (btnPct && btnCount) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderAgeChart();
}

function setDistrictMode(mode) {
  currentDistrictMode = mode;
  var btnPct = document.getElementById('btn-dist-unit-pct');
  var btnCount = document.getElementById('btn-dist-unit-count');
  if (btnPct && btnCount) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderDistrictChart();
}

function setPrecinctMode(mode) {
  currentPrecinctMode = mode;
  var btnCount = document.getElementById('btn-precinct-count');
  var btnPct = document.getElementById('btn-precinct-pct');
  if (btnCount && btnPct) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderPrecinctChart();
}

function onPrecinctSearch(query) {
  currentPrecinctSearchQuery = (query || '').toLowerCase().trim();
  renderPrecinctChart();
}

function renderAgeChart() {
  if (ageChartRef) ageChartRef.destroy();
  var ctx = document.getElementById('ageChart');
  if (!ctx) return;

  var demo = TURNOUT_DATA.demographics.ageGroups || {};
  var labels = ['18-29', '30-49', '50-64', '65+'];
  if (demo['Unknown']) labels.push('Unknown');
  if (demo['<18']) labels.unshift('<18');

  var repData = [];
  var demData = [];
  var genData = [];
  var isPctMode = (currentAgeMode === 'pct');

  for (var i = 0; i < labels.length; i++) {
    var group = demo[labels[i]] || { republican: 0, democrat: 0, general: 0, total: 0 };
    var tot = group.total || (group.republican + group.democrat + group.general) || 1;

    if (isPctMode) {
      repData.push(parseFloat(((group.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((group.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((group.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(group.republican || 0);
      demData.push(group.democrat || 0);
      genData.push(group.general || 0);
    }
  }

  ageChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: isPctMode ? 'Republican %' : 'Republican Voters', data: repData, backgroundColor: '#D32F2F' },
        { label: isPctMode ? 'Democrat %' : 'Democrat Voters', data: demData, backgroundColor: '#1976D2' },
        { label: isPctMode ? 'General %' : 'General/Other', data: genData, backgroundColor: '#F57C00' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Share (%)' : 'Voter Count' }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.y;
              var label = context.dataset.label || '';
              return isPctMode ? (label + ': ' + val + '%') : (label + ': ' + formatNumber(val) + ' voters');
            }
          }
        },
        datalabels: {
          display: function(context) {
            var val = context.dataset.data[context.dataIndex];
            return isPctMode ? (val > 4) : (val > 30);
          },
          color: function(context) {
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 10 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

function renderGenderChart() {
  if (genderChartRef) genderChartRef.destroy();
  var ctx = document.getElementById('genderChart');
  if (!ctx) return;

  var demo = TURNOUT_DATA.demographics.sex || {};
  var keys = ['F', 'M'];
  if (demo['Other/Unknown']) keys.push('Other/Unknown');

  var labels = [];
  var totals = [];
  var bgColors = ['#E91E63', '#0288D1', '#757575'];

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var displayLabel = key === 'F' ? 'Female' : (key === 'M' ? 'Male' : 'Other/Unknown');
    var group = demo[key] || { total: 0 };
    labels.push(displayLabel);
    totals.push(group.total || 0);
  }

  genderChartRef = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: totals,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var label = context.label || '';
              var val = context.parsed;
              var key = keys[context.dataIndex];
              var group = demo[key] || {};
              var rep = group.republican || 0;
              var dem = group.democrat || 0;
              var gen = group.general || 0;
              return label + ': ' + formatNumber(val) + ' (REP: ' + formatNumber(rep) + ', DEM: ' + formatNumber(dem) + ', GEN: ' + formatNumber(gen) + ')';
            }
          }
        },
        datalabels: {
          display: true,
          color: '#FFFFFF',
          font: { weight: 'bold', size: 11 },
          formatter: function(value, ctx) {
            var sum = 0;
            var dataArr = ctx.chart.data.datasets[0].data;
            dataArr.map(function(data) { sum += data; });
            var percentage = (value * 100 / sum).toFixed(1) + "%";
            return value > 0 ? percentage : '';
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderDistrictChart() {
  if (districtChartRef) districtChartRef.destroy();
  var ctx = document.getElementById('districtChart');
  if (!ctx) return;

  var districtsObj = (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.districts) ? TURNOUT_DATA.demographics.districts : {};
  var currentObj = districtsObj[currentDistrictType] || {};

  var districtKeys = Object.keys(currentObj);
  districtKeys.sort(function(a, b) {
    var numA = parseInt(a, 10);
    var numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  var labels = [];
  var repData = [];
  var demData = [];
  var genData = [];
  var isPctMode = (currentDistrictMode === 'pct');

  var prefix = currentDistrictType.charAt(0).toUpperCase() + currentDistrictType.slice(1) + ' ';
  if (currentDistrictType === 'city') prefix = '';

  for (var i = 0; i < districtKeys.length; i++) {
    var key = districtKeys[i];
    var group = currentObj[key] || { republican: 0, democrat: 0, general: 0, total: 0 };
    var tot = group.total || (group.republican + group.democrat + group.general) || 1;

    labels.push(prefix + key);

    if (isPctMode) {
      repData.push(parseFloat(((group.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((group.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((group.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(group.republican || 0);
      demData.push(group.democrat || 0);
      genData.push(group.general || 0);
    }
  }

  districtChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: isPctMode ? 'Republican %' : 'Republican Voters', data: repData, backgroundColor: '#D32F2F' },
        { label: isPctMode ? 'Democrat %' : 'Democrat Voters', data: demData, backgroundColor: '#1976D2' },
        { label: isPctMode ? 'General %' : 'General/Other', data: genData, backgroundColor: '#F57C00' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Share (%)' : 'Voter Count' }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.y;
              var label = context.dataset.label || '';
              return isPctMode ? (label + ': ' + val + '%') : (label + ': ' + formatNumber(val) + ' voters');
            }
          }
        },
        datalabels: {
          display: function(context) {
            var val = context.dataset.data[context.dataIndex];
            return isPctMode ? (val > 4) : (val > 25);
          },
          color: function(context) {
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 10 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

function renderPrecinctChart() {
  if (precinctChartRef) precinctChartRef.destroy();
  var ctx = document.getElementById('precinctChart');
  if (!ctx) return;

  var precinctsObj = (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.precincts) ? TURNOUT_DATA.demographics.precincts : {};

  var items = [];
  for (var name in precinctsObj) {
    if (precinctsObj.hasOwnProperty(name)) {
      if (!currentPrecinctSearchQuery || name.toLowerCase().includes(currentPrecinctSearchQuery)) {
        items.push({ name: name, data: precinctsObj[name] });
      }
    }
  }

  // Sort precincts strictly in alphabetical order (A to Z)
  items.sort(function(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  var allItems = items; // A to Z order (AIRPORT A at index 0 = top of chart)

  var isPctMode = (currentPrecinctMode === 'pct');

  // Prominent vertical height: 60px per precinct bar for maximum visibility and room to breathe
  var calculatedHeight = Math.max(500, allItems.length * 60);
  ctx.style.height = calculatedHeight + 'px';
  if (ctx.parentNode) {
    ctx.parentNode.style.height = calculatedHeight + 'px';
  }

  var labels = [];
  var repData = [];
  var demData = [];
  var genData = [];

  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i];
    var group = item.data;
    var tot = group.total || (group.republican + group.democrat + group.general) || 1;

    labels.push(item.name);

    if (isPctMode) {
      repData.push(parseFloat(((group.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((group.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((group.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(group.republican || 0);
      demData.push(group.democrat || 0);
      genData.push(group.general || 0);
    }
  }

  precinctChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: isPctMode ? 'Republican %' : 'Republican Voters',
          data: repData,
          backgroundColor: '#D32F2F',
          barPercentage: 0.85,
          categoryPercentage: 0.9
        },
        {
          label: isPctMode ? 'Democrat %' : 'Democrat Voters',
          data: demData,
          backgroundColor: '#1976D2',
          barPercentage: 0.85,
          categoryPercentage: 0.9
        },
        {
          label: isPctMode ? 'General %' : 'General/Other',
          data: genData,
          backgroundColor: '#F57C00',
          barPercentage: 0.85,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Primary Share (%)' : 'Voter Count', font: { size: 13, weight: 'bold' } }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 13, weight: '700' }, color: '#1B2A4A' }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 16, font: { size: 13, weight: '700' } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              var label = context.dataset.label || '';
              if (isPctMode) {
                return label + ': ' + val + '%';
              } else {
                return label + ': ' + formatNumber(val) + ' voters';
              }
            }
          }
        },
        datalabels: {
          display: function(context) {
            var val = context.dataset.data[context.dataIndex];
            return isPctMode ? (val > 3) : (val > 10);
          },
          color: function(context) {
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 12 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

function setTop10PrecinctMode(mode) {
  currentTop10PrecinctMode = mode;
  var btnCount = document.getElementById('btn-top10-count');
  var btnPct = document.getElementById('btn-top10-pct');
  if (btnCount && btnPct) {
    if (mode === 'pct') {
      btnPct.classList.add('active');
      btnCount.classList.remove('active');
    } else {
      btnCount.classList.add('active');
      btnPct.classList.remove('active');
    }
  }
  renderTop10PrecinctChart();
}

function renderTop10PrecinctChart() {
  if (top10PrecinctChartRef) top10PrecinctChartRef.destroy();
  var ctx = document.getElementById('top10PrecinctChart');
  if (!ctx) return;

  var precinctsObj = (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.precincts) ? TURNOUT_DATA.demographics.precincts : {};

  var items = [];
  for (var name in precinctsObj) {
    if (precinctsObj.hasOwnProperty(name)) {
      items.push({ name: name, data: precinctsObj[name] });
    }
  }

  // Sort descending by total turnout and select top 10
  items.sort(function(a, b) {
    return (b.data.total || 0) - (a.data.total || 0);
  });
  var top10 = items.slice(0, 10);

  var isPctMode = (currentTop10PrecinctMode === 'pct');

  var labels = [];
  var repData = [];
  var demData = [];
  var genData = [];

  for (var i = 0; i < top10.length; i++) {
    var item = top10[i];
    var group = item.data;
    var tot = group.total || (group.republican + group.democrat + group.general) || 1;

    labels.push((i + 1) + ". " + item.name);

    if (isPctMode) {
      repData.push(parseFloat(((group.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((group.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((group.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(group.republican || 0);
      demData.push(group.democrat || 0);
      genData.push(group.general || 0);
    }
  }

  top10PrecinctChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: isPctMode ? 'Republican %' : 'Republican Voters',
          data: repData,
          backgroundColor: '#D32F2F',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        },
        {
          label: isPctMode ? 'Democrat %' : 'Democrat Voters',
          data: demData,
          backgroundColor: '#1976D2',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        },
        {
          label: isPctMode ? 'General %' : 'General/Other',
          data: genData,
          backgroundColor: '#F57C00',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Primary Share (%)' : 'Voter Count', font: { size: 12, weight: 'bold' } }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 12, weight: '700' }, color: '#1B2A4A' }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 14, font: { size: 12, weight: '600' } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              var label = context.dataset.label || '';
              if (isPctMode) {
                return label + ': ' + val + '%';
              } else {
                return label + ': ' + formatNumber(val) + ' voters';
              }
            }
          }
        },
        datalabels: {
          display: function(context) {
            var val = context.dataset.data[context.dataIndex];
            return isPctMode ? (val > 4) : (val > 15);
          },
          color: function(context) {
            return context.datasetIndex === 2 ? '#1B2A4A' : '#FFFFFF';
          },
          font: { weight: 'bold', size: 11 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

/* ==========================================================================
   First-Time Hamilton County Voters Visualizations & Interactive Handlers
   ========================================================================== */

function renderFirstTimeCharts() {
  if (ftPartyChartRef) ftPartyChartRef.destroy();
  if (ftSexChartRef) ftSexChartRef.destroy();
  if (ftAgeChartRef) ftAgeChartRef.destroy();
  if (ftDailyTrendChartRef) ftDailyTrendChartRef.destroy();
  if (ftLocationChartRef) ftLocationChartRef.destroy();
  if (ftDistrictChartRef) ftDistrictChartRef.destroy();
  if (top5FTPrecinctChartRef) top5FTPrecinctChartRef.destroy();

  renderFTPartyChart();
  renderFTSexChart();
  renderFTAgeChart();
  renderFTDailyTrendChart();
  renderFTLocationChart();
  renderFTDistrictChart();
  renderTop5FTPrecinctChart();
}

function setFTPartyMode(mode) {
  currentFTPartyMode = mode;
  var pctBtn = document.getElementById('btn-ft-party-pct');
  var cntBtn = document.getElementById('btn-ft-party-count');
  if (pctBtn) pctBtn.classList.toggle('active', mode === 'pct');
  if (cntBtn) cntBtn.classList.toggle('active', mode === 'count');
  renderFTPartyChart();
}

function setFTSexMode(mode) {
  currentFTSexMode = mode;
  var pctBtn = document.getElementById('btn-ft-sex-pct');
  var cntBtn = document.getElementById('btn-ft-sex-count');
  if (pctBtn) pctBtn.classList.toggle('active', mode === 'pct');
  if (cntBtn) cntBtn.classList.toggle('active', mode === 'count');
  renderFTSexChart();
}

function setFTAgeMode(mode) {
  currentFTAgeMode = mode;
  var pctBtn = document.getElementById('btn-ft-age-pct');
  var cntBtn = document.getElementById('btn-ft-age-count');
  if (pctBtn) pctBtn.classList.toggle('active', mode === 'pct');
  if (cntBtn) cntBtn.classList.toggle('active', mode === 'count');
  renderFTAgeChart();
}

function setFTLocationMode(mode) {
  currentFTLocationMode = mode;
  var pctBtn = document.getElementById('btn-ft-loc-pct');
  var cntBtn = document.getElementById('btn-ft-loc-count');
  if (pctBtn) pctBtn.classList.toggle('active', mode === 'pct');
  if (cntBtn) cntBtn.classList.toggle('active', mode === 'count');
  renderFTLocationChart();
}

function setFTDistrictView(view) {
  currentFTDistrictView = view;
  var views = ['commission', 'senate', 'house', 'school', 'city'];
  views.forEach(function(v) {
    var btn = document.getElementById('btn-ft-dist-' + v);
    if (btn) btn.classList.toggle('active', v === view);
  });
  renderFTDistrictChart();
}

function setFTDistrictMode(mode) {
  currentFTDistrictMode = mode;
  var pctBtn = document.getElementById('btn-ft-dist-unit-pct');
  var cntBtn = document.getElementById('btn-ft-dist-unit-count');
  if (pctBtn) pctBtn.classList.toggle('active', mode === 'pct');
  if (cntBtn) cntBtn.classList.toggle('active', mode === 'count');
  renderFTDistrictChart();
}

// 1. First-Time Voters Partisan Split Chart
function renderFTPartyChart() {
  if (ftPartyChartRef) ftPartyChartRef.destroy();
  var ctx = document.getElementById('ftPartyChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var pb = ft.partyBreakdown || {};
  var isPctMode = currentFTPartyMode === 'pct';

  var dem = pb.democrat || 0;
  var rep = pb.republican || 0;
  var gen = pb.general || 0;
  var total = dem + rep + gen || 1;

  var dataVals = isPctMode 
    ? [parseFloat((dem / total * 100).toFixed(1)), parseFloat((rep / total * 100).toFixed(1)), parseFloat((gen / total * 100).toFixed(1))]
    : [dem, rep, gen];

  ftPartyChartRef = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Democrat Primary', 'Republican Primary', 'General Election'],
      datasets: [{
        data: dataVals,
        backgroundColor: ['#1976D2', '#D32F2F', '#F57C00'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12, weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed;
              if (isPctMode) {
                var rawCount = [dem, rep, gen][context.dataIndex];
                return context.label + ': ' + val + '% (' + formatNumber(rawCount) + ' voters)';
              } else {
                var pct = ((val / total) * 100).toFixed(1);
                return context.label + ': ' + formatNumber(val) + ' voters (' + pct + '%)';
              }
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 13 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

// 1b. First-Time Voters Turnout by Sex Chart
function renderFTSexChart() {
  if (ftSexChartRef) ftSexChartRef.destroy();
  var ctx = document.getElementById('ftSexChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var sexData = ft.sex || {};
  var isPctMode = currentFTSexMode === 'pct';

  var keys = ['F', 'M'];
  if (sexData['U'] || sexData['Unknown'] || sexData['Other/Unknown']) {
    keys.push(sexData['U'] ? 'U' : (sexData['Unknown'] ? 'Unknown' : 'Other/Unknown'));
  }

  var labels = keys.map(function(k) {
    if (k === 'F') return 'Female';
    if (k === 'M') return 'Male';
    return 'Other/Unknown';
  });

  var repData = [];
  var demData = [];
  var genData = [];

  keys.forEach(function(k) {
    var item = sexData[k] || { total: 0, republican: 0, democrat: 0, general: 0 };
    var tot = item.total || 1;
    if (isPctMode) {
      repData.push(parseFloat(((item.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((item.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((item.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(item.republican);
      demData.push(item.democrat);
      genData.push(item.general);
    }
  });

  ftSexChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Democrat', data: demData, backgroundColor: '#1976D2' },
        { label: 'Republican', data: repData, backgroundColor: '#D32F2F' },
        { label: 'General/Other', data: genData, backgroundColor: '#F57C00' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? '% Share within Group' : 'First-Time Voter Count' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.y;
              return context.dataset.label + ': ' + (isPctMode ? val + '%' : formatNumber(val) + ' voters');
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 11 },
          formatter: function(val) {
            if (isPctMode) return val > 5 ? val.toFixed(0) + '%' : '';
            return val > 3 ? formatNumber(val) : '';
          }
        }
      }
    }
  });
}

// 2. First-Time Voters Age Distribution Chart
function renderFTAgeChart() {
  if (ftAgeChartRef) ftAgeChartRef.destroy();
  var ctx = document.getElementById('ftAgeChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var ageGroups = ft.ageGroups || {};
  var isPctMode = currentFTAgeMode === 'pct';

  var brackets = ['18-29', '30-49', '50-64', '65+'];
  var repData = [];
  var demData = [];
  var genData = [];

  brackets.forEach(function(b) {
    var item = ageGroups[b] || { total: 0, republican: 0, democrat: 0, general: 0 };
    var tot = item.total || 1;
    if (isPctMode) {
      repData.push(parseFloat(((item.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((item.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((item.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(item.republican);
      demData.push(item.democrat);
      genData.push(item.general);
    }
  });

  ftAgeChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: brackets,
      datasets: [
        { label: 'Democrat', data: demData, backgroundColor: '#1976D2' },
        { label: 'Republican', data: repData, backgroundColor: '#D32F2F' },
        { label: 'General/Other', data: genData, backgroundColor: '#F57C00' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? '% Share within Age Bracket' : 'Number of First-Time Voters' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.y;
              return context.dataset.label + ': ' + (isPctMode ? val + '%' : formatNumber(val) + ' voters');
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 11 },
          formatter: function(val) {
            if (isPctMode) return val > 5 ? val.toFixed(0) + '%' : '';
            return val > 3 ? formatNumber(val) : '';
          }
        }
      }
    }
  });
}

// 3. Daily First-Time Co. Voter Trend
function renderFTDailyTrendChart() {
  if (ftDailyTrendChartRef) ftDailyTrendChartRef.destroy();
  var ctx = document.getElementById('ftDailyTrendChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var trend = ft.dailyTrend || {};

  var sortedDates = Object.keys(trend).sort();
  var counts = sortedDates.map(function(d) { return trend[d]; });

  var labels = sortedDates.map(function(d) {
    var parts = d.split('-');
    if (parts.length === 3) return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
    return d;
  });

  ftDailyTrendChartRef = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'First-Time Co. Voters per Day',
        data: counts,
        borderColor: '#D4A843',
        backgroundColor: 'rgba(212, 168, 67, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#1B2A4A',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: 'Daily First-Time Voters' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'First-Time Co. Voters: ' + formatNumber(context.parsed.y);
            }
          }
        },
        datalabels: {
          align: 'top',
          anchor: 'end',
          color: '#1B2A4A',
          font: { weight: 'bold', size: 11 },
          formatter: function(val) {
            return val > 0 ? formatNumber(val) : '';
          }
        }
      }
    }
  });
}

// 4. First-Time Co. Voters by Location
function renderFTLocationChart() {
  if (ftLocationChartRef) ftLocationChartRef.destroy();
  var ctx = document.getElementById('ftLocationChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var locs = ft.locations || {};
  var isPctMode = currentFTLocationMode === 'pct';
  var totalFT = ft.total || 1;

  var sortedLocs = Object.keys(locs).sort(function(a, b) { return locs[b] - locs[a]; });
  var dataVals = sortedLocs.map(function(loc) {
    var cnt = locs[loc];
    return isPctMode ? parseFloat(((cnt / totalFT) * 100).toFixed(1)) : cnt;
  });

  ftLocationChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedLocs,
      datasets: [{
        label: isPctMode ? '% Share of First-Time Voters' : 'First-Time Voters',
        data: dataVals,
        backgroundColor: '#2A3F6B',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? '% Share' : 'Voter Count' }
        },
        y: { grid: { display: false }, ticks: { font: { weight: '600' } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              return isPctMode ? val + '%' : formatNumber(val) + ' voters';
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'right',
          color: '#1B2A4A',
          font: { weight: 'bold', size: 11 },
          formatter: function(val) {
            return isPctMode ? val.toFixed(1) + '%' : formatNumber(val);
          }
        }
      }
    }
  });
}

// 5. First-Time Co. Voters District Chart
function renderFTDistrictChart() {
  if (ftDistrictChartRef) ftDistrictChartRef.destroy();
  var ctx = document.getElementById('ftDistrictChart');
  if (!ctx || !TURNOUT_DATA.firstTimeVoters) return;

  var ft = TURNOUT_DATA.firstTimeVoters;
  var distObj = (ft.districts && ft.districts[currentFTDistrictView]) || {};
  var isPctMode = currentFTDistrictMode === 'pct';

  var keys = Object.keys(distObj).sort(function(a, b) {
    var na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  var labels = keys.map(function(k) { return 'District ' + k; });
  var repData = [], demData = [], genData = [];

  keys.forEach(function(k) {
    var item = distObj[k] || { total: 0, republican: 0, democrat: 0, general: 0 };
    var tot = item.total || 1;
    if (isPctMode) {
      repData.push(parseFloat(((item.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((item.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((item.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(item.republican);
      demData.push(item.democrat);
      genData.push(item.general);
    }
  });

  ftDistrictChartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Democrat', data: demData, backgroundColor: '#1976D2' },
        { label: 'Republican', data: repData, backgroundColor: '#D32F2F' },
        { label: 'General/Other', data: genData, backgroundColor: '#F57C00' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Share (%)' : 'First-Time Voter Count' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.y;
              return context.dataset.label + ': ' + (isPctMode ? val + '%' : formatNumber(val) + ' voters');
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 10 },
          formatter: function(val) {
            if (isPctMode) return val > 8 ? val.toFixed(0) + '%' : '';
            return val > 2 ? formatNumber(val) : '';
          }
        }
      }
    }
  });
}

/* ==========================================================================
   Top 5 Precinct Analytics Visualizations (Location, Age, FT, Districts)
   ========================================================================== */

function populateTop5LocationSelectOptions() {
  var sel = document.getElementById('top5-loc-select');
  if (!sel || !TURNOUT_DATA || !TURNOUT_DATA.demographics || !TURNOUT_DATA.demographics.precinctsByLocation) return;

  var locs = Object.keys(TURNOUT_DATA.demographics.precinctsByLocation).sort();
  var currVal = sel.value || 'ALL';
  sel.innerHTML = '<option value="ALL">All Locations Combined</option>';

  locs.forEach(function(loc) {
    var opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    sel.appendChild(opt);
  });
  sel.value = currVal;
}

function populateTop5DistrictSelectOptions() {
  var sel = document.getElementById('top5-dist-select');
  if (!sel || !TURNOUT_DATA || !TURNOUT_DATA.demographics || !TURNOUT_DATA.demographics.precinctsByDistrict) return;

  var distDict = TURNOUT_DATA.demographics.precinctsByDistrict[currentTop5DistType] || {};
  var distNames = Object.keys(distDict).sort(function(a, b) {
    var numA = parseInt(a.replace(/\D/g, '')) || 0;
    var numB = parseInt(b.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  var currVal = sel.value || 'ALL';
  sel.innerHTML = '<option value="ALL">All Districts Combined</option>';

  distNames.forEach(function(dName) {
    var opt = document.createElement('option');
    opt.value = dName;
    opt.textContent = dName;
    sel.appendChild(opt);
  });
  if (distNames.indexOf(currVal) !== -1) {
    sel.value = currVal;
  } else {
    sel.value = 'ALL';
  }
  currentTop5DistName = sel.value;
}

function createTop5PrecinctChart(canvasId, currentRef, precinctsDict, isPctMode) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  if (currentRef) {
    currentRef.destroy();
  }

  var items = [];
  if (precinctsDict) {
    for (var name in precinctsDict) {
      if (precinctsDict.hasOwnProperty(name)) {
        var group = precinctsDict[name];
        var tot = group.total || (group.republican + group.democrat + group.general) || 0;
        if (tot > 0) {
          items.push({ name: name, data: group, total: tot });
        }
      }
    }
  }

  items.sort(function(a, b) { return b.total - a.total; });
  var top5 = items.slice(0, 5);

  var labels = [];
  var repData = [];
  var demData = [];
  var genData = [];

  for (var i = 0; i < top5.length; i++) {
    var item = top5[i];
    var group = item.data;
    var tot = item.total || 1;

    labels.push((i + 1) + ". " + item.name);

    if (isPctMode) {
      repData.push(parseFloat(((group.republican / tot) * 100).toFixed(1)));
      demData.push(parseFloat(((group.democrat / tot) * 100).toFixed(1)));
      genData.push(parseFloat(((group.general / tot) * 100).toFixed(1)));
    } else {
      repData.push(group.republican || 0);
      demData.push(group.democrat || 0);
      genData.push(group.general || 0);
    }
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: isPctMode ? 'Republican %' : 'Republican',
          data: repData,
          backgroundColor: '#D32F2F',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        },
        {
          label: isPctMode ? 'Democrat %' : 'Democrat',
          data: demData,
          backgroundColor: '#1976D2',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        },
        {
          label: isPctMode ? 'General %' : 'General/Other',
          data: genData,
          backgroundColor: '#F57C00',
          barPercentage: 0.75,
          categoryPercentage: 0.85
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: isPctMode ? 100 : undefined,
          grid: { color: '#E2E8F0' },
          title: { display: true, text: isPctMode ? 'Partisan Share (%)' : 'Voter Count', font: { size: 11, weight: 'bold' } }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 11, weight: '600' }, color: '#1B2A4A' }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, weight: '600' } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              var val = context.parsed.x;
              var label = context.dataset.label || '';
              return isPctMode ? label + ': ' + val + '%' : label + ': ' + formatNumber(val) + ' voters';
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 10 },
          formatter: function(value) {
            if (isPctMode) return value > 8 ? value.toFixed(0) + '%' : '';
            return value > 10 ? formatNumber(value) : '';
          }
        }
      }
    }
  });
}

function setTop5LocLocation(loc) {
  currentTop5LocLocation = loc;
  renderTop5LocationPrecinctChart();
}

function setTop5LocMode(mode) {
  currentTop5LocMode = mode;
  var btnCount = document.getElementById('btn-top5-loc-count');
  var btnPct = document.getElementById('btn-top5-loc-pct');
  if (btnCount) btnCount.classList.toggle('active', mode === 'count');
  if (btnPct) btnPct.classList.toggle('active', mode === 'pct');
  renderTop5LocationPrecinctChart();
}

function renderTop5LocationPrecinctChart() {
  var dict = null;
  if (currentTop5LocLocation === 'ALL') {
    dict = TURNOUT_DATA.demographics ? TURNOUT_DATA.demographics.precincts : {};
  } else if (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.precinctsByLocation) {
    dict = TURNOUT_DATA.demographics.precinctsByLocation[currentTop5LocLocation] || {};
  }
  top5LocationPrecinctChartRef = createTop5PrecinctChart('top5LocationPrecinctChart', top5LocationPrecinctChartRef, dict, currentTop5LocMode === 'pct');
}

function setTop5AgeBracket(bracket) {
  currentTop5AgeBracket = bracket;
  var map = { 'ALL': 'btn-top5-age-all', '18-29': 'btn-top5-age-18', '30-49': 'btn-top5-age-30', '50-64': 'btn-top5-age-50', '65+': 'btn-top5-age-65' };
  Object.keys(map).forEach(function(k) {
    var btn = document.getElementById(map[k]);
    if (btn) btn.classList.toggle('active', k === bracket);
  });
  renderTop5AgePrecinctChart();
}

function setTop5AgeMode(mode) {
  currentTop5AgeMode = mode;
  var btnCount = document.getElementById('btn-top5-age-count');
  var btnPct = document.getElementById('btn-top5-age-pct');
  if (btnCount) btnCount.classList.toggle('active', mode === 'count');
  if (btnPct) btnPct.classList.toggle('active', mode === 'pct');
  renderTop5AgePrecinctChart();
}

function renderTop5AgePrecinctChart() {
  var dict = null;
  if (currentTop5AgeBracket === 'ALL') {
    dict = TURNOUT_DATA.demographics ? TURNOUT_DATA.demographics.precincts : {};
  } else if (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.precinctsByAgeGroup) {
    dict = TURNOUT_DATA.demographics.precinctsByAgeGroup[currentTop5AgeBracket] || {};
  }
  top5AgePrecinctChartRef = createTop5PrecinctChart('top5AgePrecinctChart', top5AgePrecinctChartRef, dict, currentTop5AgeMode === 'pct');
}

function setFTTop5PrecinctMode(mode) {
  currentFTTop5PrecinctMode = mode;
  var btnCount = document.getElementById('btn-ft-top5-count');
  var btnPct = document.getElementById('btn-ft-top5-pct');
  if (btnCount) btnCount.classList.toggle('active', mode === 'count');
  if (btnPct) btnPct.classList.toggle('active', mode === 'pct');
  renderTop5FTPrecinctChart();
}

function renderTop5FTPrecinctChart() {
  var dict = (TURNOUT_DATA.firstTimeVoters && TURNOUT_DATA.firstTimeVoters.precincts) ? TURNOUT_DATA.firstTimeVoters.precincts : {};
  top5FTPrecinctChartRef = createTop5PrecinctChart('top5FTPrecinctChart', top5FTPrecinctChartRef, dict, currentFTTop5PrecinctMode === 'pct');
}

function setTop5DistrictType(type) {
  currentTop5DistType = type;
  ['commission', 'senate', 'house', 'school', 'city'].forEach(function(t) {
    var btn = document.getElementById('btn-top5-dist-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
  populateTop5DistrictSelectOptions();
  renderTop5DistrictPrecinctChart();
}

function setTop5DistrictName(name) {
  currentTop5DistName = name;
  renderTop5DistrictPrecinctChart();
}

function setTop5DistrictMode(mode) {
  currentTop5DistMode = mode;
  var btnCount = document.getElementById('btn-top5-dist-count');
  var btnPct = document.getElementById('btn-top5-dist-pct');
  if (btnCount) btnCount.classList.toggle('active', mode === 'count');
  if (btnPct) btnPct.classList.toggle('active', mode === 'pct');
  renderTop5DistrictPrecinctChart();
}

function renderTop5DistrictPrecinctChart() {
  var dict = null;
  if (TURNOUT_DATA.demographics && TURNOUT_DATA.demographics.precinctsByDistrict) {
    var distGroup = TURNOUT_DATA.demographics.precinctsByDistrict[currentTop5DistType] || {};
    if (currentTop5DistName === 'ALL') {
      dict = {};
      for (var dName in distGroup) {
        if (distGroup.hasOwnProperty(dName)) {
          var pDict = distGroup[dName];
          for (var pName in pDict) {
            if (pDict.hasOwnProperty(pName)) {
              if (!dict[pName]) dict[pName] = { total: 0, republican: 0, democrat: 0, general: 0 };
              dict[pName].total += pDict[pName].total || 0;
              dict[pName].republican += pDict[pName].republican || 0;
              dict[pName].democrat += pDict[pName].democrat || 0;
              dict[pName].general += pDict[pName].general || 0;
            }
          }
        }
      }
    } else {
      dict = distGroup[currentTop5DistName] || {};
    }
  }
  top5DistrictPrecinctChartRef = createTop5PrecinctChart('top5DistrictPrecinctChart', top5DistrictPrecinctChartRef, dict, currentTop5DistMode === 'pct');
}
