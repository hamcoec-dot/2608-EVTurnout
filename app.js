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
  
  // Render Turnout Table
  renderTurnoutTable();
  
  // Render Comparison Table
  renderComparisonTable();
  
  // Render Charts
  renderCharts();
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
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  var day = parseInt(parts[2], 10);
  
  var endDate = new Date(year, month, day);
  var now = new Date();
  
  // Get today's date at midnight
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  var diffTime = endDate - today;
  var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
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
      backgroundColor: 'rgba(27, 42, 74, 0.1)',
      borderWidth: 4,
      pointRadius: 4,
      pointBackgroundColor: '#1B2A4A',
      tension: 0.1,
      fill: false
    }
  ];
  
  if (y2024.length > 0) {
    datasets.push({
      label: '2024 Election',
      data: y2024,
      borderColor: '#3B6FA0',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 2,
      tension: 0.1,
      fill: false
    });
  }
  
  if (y2022.length > 0) {
    datasets.push({
      label: '2022 Election',
      data: y2022,
      borderColor: '#C4483E',
      borderWidth: 2,
      borderDash: [3, 3],
      pointRadius: 2,
      tension: 0.1,
      fill: false
    });
  }

  if (y2020.length > 0) {
    datasets.push({
      label: '2020 Election',
      data: y2020,
      borderColor: '#7E57C2',
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 2,
      tension: 0.1,
      fill: false
    });
  }
  
  if (y2018.length > 0) {
    datasets.push({
      label: '2018 Election',
      data: y2018,
      borderColor: '#D4A843',
      borderWidth: 2,
      borderDash: [1, 1],
      pointRadius: 2,
      tension: 0.1,
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
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 15, font: { size: 11 } }
          },
          datalabels: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#E2E8F0' },
            title: { display: true, text: 'Total Votes Cast' }
          },
          x: {
            grid: { display: false },
            title: { display: true, text: 'Early Voting Day timeline' }
          }
        }
      }
    });
  }
  
  // 2. Turnout by location horizontal bar chart
  var locLabels = [];
  var locValues = [];
  for (var j = 0; j < TURNOUT_DATA.locations.length; j++) {
    var lName = TURNOUT_DATA.locations[j];
    locLabels.push(lName);
    locValues.push(TURNOUT_DATA.totals[lName] || 0);
  }
  
  var ctx2 = document.getElementById('locationChart');
  if (ctx2) {
    locationChartRef = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: locLabels,
        datasets: [{
          label: 'Total Voters',
          data: locValues,
          backgroundColor: '#D4A843',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'end',
            color: '#1B2A4A',
            font: { weight: 'bold', size: 10 },
            formatter: function(value) {
              return value > 0 ? formatNumber(value) : '';
            }
          }
        },
        scales: {
          x: {
            grace: '10%',
            beginAtZero: true,
            grid: { color: '#E2E8F0' }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }
  
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
