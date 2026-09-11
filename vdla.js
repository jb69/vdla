var saved_board_mode = localStorage.getItem("vdla-board-mode");
var board_mode = saved_board_mode === "efoil" ? "efoil" : "eskate";
var units = ["°C", "A", "A", "%", "km/h", "V", "Ah", "Ah", "Wh", "Wh", "km", "W", "m", "km/h"]
var axes_names = units.filter(function (item, pos, self) {
  return self.indexOf(item) == pos;
})
var colors = ["red", "purple", "green", "lime", "navy", "blue", "orange", "cyan", "darkcyan", "olive", "yellow", "teal", "maroon", "fuchsia"]
var fill = ["rgba(255, 0, 0, 0.3)", "rgba(128, 0, 128, 0.3)", "rgba(0, 128, 0, 0.3)", "rgba(0, 255, 0, 0.3)", "rgba(0, 0, 128, 0.3)", "rgba(0, 0, 255, 0.3)", "rgba(255, 165, 0, 0.3)", "rgba(0, 255, 255, 0.3)", "rgba(0, 139, 139, 0.3)", "rgba(128, 128, 0, 0.3)", "rgba(255, 255, 0, 0.3)", "rgba(0, 128, 128, 0.3)", "rgba(128, 0, 0, 0.3)", "rgba(255, 0, 255, 0.3)"]
var series_shown = [true, false, true, true, true, true, false, false, false, false, false, true, false, false];
var default_units = units.slice();
var default_series_shown = series_shown.slice();
var Times = [];
var TempPcbs = [];
var MotorTemps = [];
var MotorCurrents = [];
var BatteryCurrents = [];
var DutyCycles = [];
var Speeds = [];
var InpVoltages = [];
var AmpHours = [];
var AmpHoursCharged = [];
var WattHours = [];
var WattHoursCharged = [];
var Distances = [];
var Powers = [];
var Faults = [];
var TimePassedInMss = [];
var latlngs = [];
var Altitudes = [];
var GPSSpeeds = [];
var VerticalSpeeds = [];
var HorizontalAccuracies = [];
var GnssDistances = [];
var names = [];
var base_names = [];
var data = [];
var curr_plot_indx = 0;
var curr_map_indx = 0;
var playback_running = false;
var playback_request;
var playback_started_at = 0;
var playback_origin_time = 0;
var playback_speed = 1;
var map;
var uplot;
var menu_visible = false;
var map_popup;
var overview_plot;
var active_tab = "log";
var FAULT_NAMES = {
  1: "Over voltage",
  2: "Under voltage",
  3: "DRV gate driver",
  4: "Absolute over-current",
  5: "Controller over-temperature",
  6: "Motor over-temperature",
  7: "Gate driver over-voltage",
  8: "Gate driver under-voltage",
  9: "MCU under-voltage",
  10: "Booting from watchdog reset",
  11: "Encoder SPI",
  12: "Encoder sin/cos amplitude",
  13: "Flash corruption",
  14: "High offset current sensor 1",
  15: "High offset current sensor 2",
  16: "High offset current sensor 3",
  17: "Unbalanced currents"
};

//uplot plugins
function touchZoomPlugin(opts) {
  function init(u, opts, data) {
    let plot = u.root.querySelector(".over");
    let rect, oxRange, oyRange, xVal, yVal;
    let fr = { x: 0, y: 0, dx: 0, dy: 0 };
    let to = { x: 0, y: 0, dx: 0, dy: 0 };

    function storePos(t, e) {
      let ts = e.touches;

      let t0 = ts[0];
      let t0x = t0.clientX - rect.left;
      let t0y = t0.clientY - rect.top;

      if (ts.length == 1) {
        t.x = t0x;
        t.y = t0y;
        t.d = 0;
      }
      else {
        let t1 = e.touches[1];
        let t1x = t1.clientX - rect.left;
        let t1y = t1.clientY - rect.top;

        let xMin = Math.min(t0x, t1x);
        let yMin = Math.min(t0y, t1y);
        let xMax = Math.max(t0x, t1x);
        let yMax = Math.max(t0y, t1y);

        // midpts
        t.y = (yMin + yMax) / 2;
        t.x = (xMin + xMax) / 2;

        t.dx = xMax - xMin;
        t.dy = yMax - yMin;

        // dist
        t.d = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
      }
    }

    let rafPending = false;

    function zoom() {
      rafPending = false;

      let left = to.x;
      let top = to.y;

      // non-uniform scaling
      //	let xFactor = fr.dx / to.dx;
      //	let yFactor = fr.dy / to.dy;

      // uniform x/y scaling
      let xFactor = fr.d / to.d;
      let yFactor = fr.d / to.d;

      let leftPct = left / rect.width;
      let btmPct = 1 - top / rect.height;

      let nxRange = oxRange * xFactor;
      let nxMin = xVal - leftPct * nxRange;
      let nxMax = nxMin + nxRange;

      let nyRange = oyRange * yFactor;
      let nyMin = yVal - btmPct * nyRange;
      let nyMax = nyMin + nyRange;

      u.batch(() => {
        u.setScale("x", {
          min: nxMin,
          max: nxMax,
        });

        u.setScale("y", {
          min: nyMin,
          max: nyMax,
        });
      });
    }

    function touchmove(e) {
      storePos(to, e);

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(zoom);
      }
    }

    plot.addEventListener("touchstart", function (e) {
      rect = plot.getBoundingClientRect();

      storePos(fr, e);

      oxRange = u.scales.x.max - u.scales.x.min;
      oyRange = u.scales.y.max - u.scales.y.min;

      let left = fr.x;
      let top = fr.y;

      xVal = u.posToVal(left, "x");
      yVal = u.posToVal(top, "y");

      document.addEventListener("touchmove", touchmove, { passive: true });
    });

    plot.addEventListener("touchend", function (e) {
      document.removeEventListener("touchmove", touchmove, { passive: true });
    });
  }

  return {
    hooks: {
      init
    }
  };
}

function update_playback_status(index) {
  var status = document.getElementById("playback_status");
  if (!status || !Times.length) return;
  status.textContent = new Date(Times[index] * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function set_playback_index(index) {
  if (!uplot || !Times.length) return;
  index = Math.max(0, Math.min(index, Times.length - 1));
  update_map_popup(index);
  curr_plot_indx = index;
  uplot.setCursor({ left: uplot.valToPos(Times[index], "x"), top: 0 });
  update_playback_status(index);
}

function stop_playback() {
  playback_running = false;
  if (playback_request) {
    cancelAnimationFrame(playback_request);
    playback_request = null;
  }
  var toggle = document.getElementById("playback_toggle");
  if (toggle) {
    toggle.textContent = "Play";
    toggle.setAttribute("aria-label", "Play log");
  }
}

function playback_frame(timestamp) {
  if (!playback_running || !Times.length) return;
  var target_time = playback_origin_time + (timestamp - playback_started_at) / 1000 * playback_speed;
  var index = 0;
  var low = 0;
  var high = Times.length - 1;
  while (low <= high) {
    var middle = Math.floor((low + high) / 2);
    if (Times[middle] <= target_time) {
      index = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  set_playback_index(index);
  if (target_time >= Times[Times.length - 1]) {
    stop_playback();
    set_playback_index(Times.length - 1);
    return;
  }
  playback_request = requestAnimationFrame(playback_frame);
}

function start_playback() {
  if (!uplot || Times.length < 2) return;
  if (curr_plot_indx >= Times.length - 1) curr_plot_indx = 0;
  playback_running = true;
  playback_origin_time = Times[curr_plot_indx];
  playback_started_at = performance.now();
  var toggle = document.getElementById("playback_toggle");
  toggle.textContent = "Pause";
  toggle.setAttribute("aria-label", "Pause log");
  playback_request = requestAnimationFrame(playback_frame);
}

function toggle_playback() {
  if (playback_running) {
    stop_playback();
  } else {
    start_playback();
  }
}

function restart_playback() {
  stop_playback();
  curr_plot_indx = 0;
  set_playback_index(0);
}

//utils

function compare_filetimes(a, b) {
  if (a.time > b.time) return 1;
  if (b.time > a.time) return -1;

  return 0;
}

function getAllIndexes(arr, val) {
  var indexes = [], i;
  for (i = 0; i < arr.length; i++)
    if (arr[i] === val)
      indexes.push(i);
  return indexes;
}

function haversine_distance_km(lat1, lon1, lat2, lon2) {
  var earth_radius_km = 6371;
  var lat_delta = (lat2 - lat1) * Math.PI / 180;
  var lon_delta = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(lat_delta / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(lon_delta / 2) ** 2;
  return 2 * earth_radius_km * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compute_gnss_metrics() {
  GnssDistances = [];
  VerticalSpeeds = [];
  var total_distance = 0;

  for (var i = 0; i < Times.length; i++) {
    if (i === 0) {
      GnssDistances.push(0);
      VerticalSpeeds.push(0);
      continue;
    }

    var elapsed_seconds = Times[i] - Times[i - 1];
    total_distance += haversine_distance_km(
      latlngs[i - 1][0], latlngs[i - 1][1], latlngs[i][0], latlngs[i][1]);

    GnssDistances.push(total_distance);
    VerticalSpeeds.push(elapsed_seconds > 0 ?
      (Altitudes[i] - Altitudes[i - 1]) / elapsed_seconds : 0);
  }
}

function apply_profile() {
  if (board_mode === "efoil") {
    // Efoils have no wheel, so the logged tacho speed/distance are meaningless.
    names = [
      "TempPcb",
      "MotorCurrent",
      "BatteryCurrent",
      "DutyCycle",
      "GNSSSpeed",
      "InpVoltage",
      "AmpHours",
      "AmpHoursCharged",
      "WattHours",
      "WattHoursCharged",
      "Distance",
      "Power",
      "Altitude",
      "VerticalSpeed",
      "HorizontalAccuracy"
    ];
    units = ["°C", "A", "A", "%", "km/h", "V", "Ah", "Ah", "Wh", "Wh", "km", "W", "m", "m/s", "m"];
    series_shown = [true, false, true, true, true, true, false, false, false, false, true, true, false, false, false];
    data = [Times, TempPcbs, MotorCurrents, BatteryCurrents, DutyCycles, GPSSpeeds,
      InpVoltages, AmpHours, AmpHoursCharged, WattHours, WattHoursCharged,
      GnssDistances, Powers, Altitudes, VerticalSpeeds, HorizontalAccuracies];
  } else {
    names = base_names.slice();
    units = default_units.slice();
    series_shown = default_series_shown.slice();
    data = [Times, TempPcbs, MotorCurrents, BatteryCurrents, DutyCycles, Speeds,
      InpVoltages, AmpHours, AmpHoursCharged, WattHours, WattHoursCharged,
      Distances, Powers, Altitudes, GPSSpeeds];
  }
  axes_names = units.filter(function (item, pos, self) {
    return self.indexOf(item) === pos;
  });
}

function set_board_mode(mode) {
  board_mode = mode === "efoil" ? "efoil" : "eskate";
  localStorage.setItem("vdla-board-mode", board_mode);
  document.getElementById('app_title').textContent = mode === "efoil" ?
    "Efoil Data Log Analyzer" : "Vesc Data Log Analyzer";
  document.getElementById('board_mode').value = mode;

  if (Times.length === 0) {
    return;
  }
  apply_profile();
  uplot.destroy();
  create_chart();
  fill_menu();
  if (active_tab === "overview") {
    render_overview();
  }
  if (active_tab === "performance") {
    render_performance();
  }
}

function handleError(txt) {
  var span = document.createElement('span');
  span.innerHTML = txt;
  document.getElementById("loader_sec").appendChild(span)
  show_loader()
}

function get_Log(url) {
  // read text from URL location
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.send(null);
  request.onreadystatechange = function () {
    if (request.readyState === 4) {
      if (request.status === 200) {
        var type = request.getResponseHeader('Content-Type');
        if (type.indexOf("text") !== 1) {
          parse_LogFile(request.responseText)
        }
      } else {
        handleError("Error Fetching Log: " + request.status + " " + request.statusText)
      }
    }
  }
}

function print_data() {
  console.log(names);
  console.log(data);
}

function throttle(cb, limit) {
  var wait = false;
  return () => {
    if (!wait) {
      requestAnimationFrame(cb);
      wait = true;
      setTimeout(() => {
        wait = false;
      }, limit);
    }
  }
}

function show_upload() {
  console.log("Showing Upload section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "visible";
}

function show_loader() {
  console.log("Showing Loader section");
  document.getElementById("loader_sec").style.visibility = "visible";
  document.getElementById("content_sec").style.visibility = "hidden";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function show_content() {
  console.log("Showing Content section");
  document.getElementById("loader_sec").style.visibility = "hidden";
  document.getElementById("content_sec").style.visibility = "visible";
  document.getElementById("upload_sec").style.visibility = "hidden";
}

function show_tab(tab) {
  active_tab = tab;
  document.getElementById("tab_overview").classList.toggle("active", tab === "overview");
  document.getElementById("tab_log").classList.toggle("active", tab === "log");
  document.getElementById("tab_performance").classList.toggle("active", tab === "performance");
  document.getElementById("overview_view").style.display = tab === "overview" ? "block" : "none";
  document.getElementById("log_view").style.display = tab === "log" ? "block" : "none";
  document.getElementById("performance_view").style.display = tab === "performance" ? "block" : "none";

  if (tab === "overview") {
    render_overview();
    return;
  }
  if (tab === "performance") {
    render_performance();
    return;
  }
  // Leaflet and uPlot need re-measuring after their container regains size.
  if (map) {
    map.invalidateSize();
  }
  if (uplot) {
    uplot.setSize(get_window_size());
  }
}

function array_min(arr) {
  var min = Infinity;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}

function array_max(arr) {
  var max = -Infinity;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

function array_mean(arr) {
  if (arr.length === 0) {
    return 0;
  }
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

function format_duration(seconds) {
  var total = Math.round(seconds);
  var hours = Math.floor(total / 3600);
  var minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return hours + "h " + minutes + "m";
  }
  return minutes + "m " + (total % 60) + "s";
}

function performance_heading(text) {
  var heading = document.createElement('div');
  heading.className = "perf_heading";
  heading.textContent = text;
  return heading;
}

function performance_card(label, value, note) {
  var card = document.createElement('div');
  card.className = "perf_card";

  var label_el = document.createElement('div');
  label_el.className = "perf_label";
  label_el.textContent = label;
  card.appendChild(label_el);

  var value_el = document.createElement('div');
  value_el.className = "perf_value";
  value_el.textContent = value;
  card.appendChild(value_el);

  if (note) {
    var note_el = document.createElement('div');
    note_el.className = "perf_note";
    note_el.textContent = note;
    card.appendChild(note_el);
  }
  return card;
}

function render_overview() {
  var container = document.getElementById("overview_content");
  var chart_container = document.getElementById("overview_chart");
  container.innerHTML = "";
  if (overview_plot) {
    overview_plot.destroy();
    overview_plot = null;
  }
  if (Times.length === 0) {
    chart_container.innerHTML = "";
    return;
  }

  var speeds = data[5];
  var powers = data[12];
  var distance = array_max(data[11]) - array_min(data[11]);
  var duration = Times[Times.length - 1] - Times[0];
  var peak_speed = array_max(speeds);
  var peak_power = array_max(powers);

  container.appendChild(performance_card("Distance", distance.toFixed(2) + " km",
    board_mode === "efoil" ? "GNSS route distance" : "tacho distance"));
  container.appendChild(performance_card("Top speed", peak_speed.toFixed(1) + " km/h",
    names[4] + " peak"));
  container.appendChild(performance_card("Peak power", peak_power.toFixed(0) + " W",
    format_duration(duration) + " session"));

  chart_container.innerHTML = "";
  var width = chart_container.offsetWidth || window.innerWidth;
  overview_plot = new uPlot({
    id: "overview_plot",
    width: width,
    height: 300,
    scales: {
      x: { time: true },
      speed: { auto: true },
      power: { auto: true },
    },
    axes: [
      { stroke: "#6f858a", grid: { stroke: "#e7efee" } },
      { scale: "speed", stroke: "#087f8c", label: "Speed (km/h)" },
      { scale: "power", side: 1, stroke: "#e28b45", label: "Power (W)" },
    ],
    series: [
      {},
      { label: names[4], scale: "speed", stroke: "#087f8c", width: 2, fill: "rgba(8, 127, 140, 0.12)" },
      { label: "Power", scale: "power", stroke: "#e28b45", width: 2 },
    ],
    cursor: { y: false },
  }, [Times, speeds, powers], chart_container);
}

function count_where(arr, predicate) {
  var total = 0;
  for (var i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) total++;
  }
  return total;
}

// Least-squares slope of voltage against current approximates pack resistance.
function estimate_pack_resistance(voltages, currents) {
  var mean_i = array_mean(currents);
  var mean_v = array_mean(voltages);
  var numerator = 0;
  var denominator = 0;
  for (var i = 0; i < currents.length; i++) {
    numerator += (currents[i] - mean_i) * (voltages[i] - mean_v);
    denominator += (currents[i] - mean_i) * (currents[i] - mean_i);
  }
  if (denominator === 0) {
    return 0;
  }
  return -numerator / denominator;
}

function analyse_performance() {
  var findings = [];
  var temps = data[1];
  var motor_current = data[2];
  var battery_current = data[3];
  var duty = data[4];
  var speeds = data[5];
  var voltages = data[6];
  var charged = data[10];
  var samples = Times.length;

  var fault_counts = {};
  for (var i = 0; i < Faults.length; i++) {
    if (Faults[i] > 0) {
      fault_counts[Faults[i]] = (fault_counts[Faults[i]] || 0) + 1;
    }
  }
  var fault_codes = Object.keys(fault_counts);
  if (fault_codes.length > 0) {
    var described = fault_codes.map(function (code) {
      return (FAULT_NAMES[code] || ("Fault code " + code)) + " (" + fault_counts[code] + "x)";
    });
    findings.push({
      severity: "critical",
      title: "Controller faults logged",
      detail: described.join(", "),
      action: fault_counts[4] ?
        "Absolute over-current trips usually mean the ABS max current is set too close to the motor current limit, or motor detection is off. Re-run FOC detection and raise the absolute maximum above your motor current limit." :
        "Review the VESC fault history and address the cause before the next session."
    });
  } else {
    findings.push({
      severity: "ok",
      title: "No controller faults",
      detail: "All " + samples + " samples reported fault code 0."
    });
  }

  var peak_fet = array_max(temps);
  var fet_hot_pct = 100 * count_where(temps, function (t) { return t > 70; }) / samples;
  if (peak_fet >= 85) {
    findings.push({
      severity: "critical",
      title: "Controller hit thermal throttling",
      detail: "Peak controller temperature " + peak_fet.toFixed(1) + " °C, at or above the 85 °C default throttle point.",
      action: "Power was almost certainly cut back. Improve controller cooling or reduce current limits."
    });
  } else if (peak_fet >= 75) {
    findings.push({
      severity: "warning",
      title: "Controller running hot",
      detail: "Peak " + peak_fet.toFixed(1) + " °C, within " + (85 - peak_fet).toFixed(1) +
        " °C of the 85 °C default throttle point. " + fet_hot_pct.toFixed(1) + "% of samples above 70 °C.",
      action: "A longer or harder run would likely throttle. Consider better heatsinking or airflow."
    });
  } else {
    findings.push({
      severity: "ok",
      title: "Controller temperature healthy",
      detail: "Peak " + peak_fet.toFixed(1) + " °C, well below the 85 °C throttle point."
    });
  }

  var peak_motor_temp = array_max(MotorTemps);
  if (peak_motor_temp > 0) {
    if (peak_motor_temp >= 85) {
      findings.push({
        severity: "critical",
        title: "Motor hit thermal throttling",
        detail: "Peak motor temperature " + peak_motor_temp.toFixed(1) + " °C, at or above the 85 °C default limit.",
        action: "Reduce sustained current or improve motor cooling."
      });
    } else if (peak_motor_temp >= 75) {
      findings.push({
        severity: "warning",
        title: "Motor running hot",
        detail: "Peak motor temperature " + peak_motor_temp.toFixed(1) + " °C, within " +
          (85 - peak_motor_temp).toFixed(1) + " °C of the default 85 °C limit.",
        action: "Motor temperature is the usual limit on sustained runs. Watch this on longer sessions."
      });
    } else {
      findings.push({
        severity: "ok",
        title: "Motor temperature healthy",
        detail: "Peak motor temperature " + peak_motor_temp.toFixed(1) + " °C."
      });
    }
  }

  var moving = count_where(speeds, function (s) { return s > 1; });
  if (moving > 0) {
    var high_duty_pct = 100 * count_where(duty, function (d) { return d > 95; }) / moving;
    if (high_duty_pct > 5) {
      findings.push({
        severity: "warning",
        title: "Hitting the duty cycle limit",
        detail: high_duty_pct.toFixed(1) + "% of moving time was above 95% duty (peak " +
          array_max(duty).toFixed(0) + "%).",
        action: "Top speed is limited by battery voltage and motor KV, not available current. More voltage or a higher KV motor would raise it."
      });
    } else {
      findings.push({
        severity: "ok",
        title: "Not duty limited",
        detail: "Only " + high_duty_pct.toFixed(1) + "% of moving time above 95% duty (peak " +
          array_max(duty).toFixed(0) + "%). Headroom remains."
      });
    }
  }

  var peak_motor_current = array_max(motor_current);
  var clipped = count_where(motor_current, function (c) { return c >= peak_motor_current * 0.98; });
  var clipped_pct = 100 * clipped / samples;
  if (clipped_pct > 5) {
    findings.push({
      severity: "warning",
      title: "Motor current is being clipped",
      detail: clipped_pct.toFixed(1) + "% of samples sat at the " + peak_motor_current.toFixed(0) +
        " A ceiling, which indicates a configured limit rather than a load limit.",
      action: "Raising the motor current limit would give more acceleration, if the motor and controller can take the heat."
    });
  } else {
    findings.push({
      severity: "ok",
      title: "Not current limited",
      detail: "Peak motor current " + peak_motor_current.toFixed(1) + " A was only touched briefly (" +
        clipped_pct.toFixed(1) + "% of samples)."
    });
  }

  var resistance = estimate_pack_resistance(voltages, battery_current);
  var peak_battery_current = array_max(battery_current);
  var sag_at_peak = resistance * peak_battery_current;
  var resting_voltage = array_max(voltages);
  if (resistance > 0) {
    var sag_pct = 100 * sag_at_peak / resting_voltage;
    findings.push({
      severity: sag_pct > 15 ? "warning" : "ok",
      title: sag_pct > 15 ? "Significant battery sag" : "Battery sag acceptable",
      detail: "Estimated pack resistance " + (resistance * 1000).toFixed(0) + " mΩ, giving about " +
        sag_at_peak.toFixed(1) + " V sag (" + sag_pct.toFixed(1) + "%) at the " +
        peak_battery_current.toFixed(0) + " A peak.",
      action: sag_pct > 15 ?
        "High sag costs top speed and stresses cells. Consider higher discharge cells, thicker leads, or better connections." : null
    });
  }

  var cells = Math.round(resting_voltage / 4.2);
  if (cells > 0) {
    var min_cell = array_min(voltages) / cells;
    findings.push({
      severity: min_cell < 3.2 ? "warning" : "ok",
      title: min_cell < 3.2 ? "Cells pulled low under load" : "Cell voltage stayed safe",
      detail: "Minimum " + array_min(voltages).toFixed(1) + " V across an estimated " + cells +
        "S pack is about " + min_cell.toFixed(2) + " V per cell.",
      action: min_cell < 3.2 ?
        "Sustained operation below 3.2 V per cell shortens pack life. Ease off earlier or raise the low voltage cutoff." : null
    });
  }

  if (array_max(HorizontalAccuracies) > 0) {
    var poor_fix_pct = 100 * count_where(HorizontalAccuracies, function (h) { return h > 5; }) / samples;
    if (poor_fix_pct > 25) {
      findings.push({
        severity: "warning",
        title: "GNSS accuracy is poor",
        detail: poor_fix_pct.toFixed(1) + "% of samples had horizontal accuracy worse than 5 m (average " +
          array_mean(HorizontalAccuracies).toFixed(1) + " m).",
        action: "GPS speed and distance carry meaningful error here. Improve antenna placement for more trustworthy figures."
      });
    }
  }

  if (array_max(charged) - array_min(charged) < 0.01) {
    findings.push({
      severity: "info",
      title: "No regenerative braking recorded",
      detail: "Nothing was returned to the pack, which is expected for an efoil but worth checking on a board with brakes."
    });
  }

  return findings;
}

function render_finding(finding) {
  var el = document.createElement('div');
  el.className = "finding " + finding.severity;

  var title = document.createElement('div');
  title.className = "finding_title";
  title.textContent = finding.title;
  el.appendChild(title);

  var detail = document.createElement('div');
  detail.className = "finding_detail";
  detail.textContent = finding.detail;
  el.appendChild(detail);

  if (finding.action) {
    var action = document.createElement('div');
    action.className = "finding_action";
    action.textContent = finding.action;
    el.appendChild(action);
  }
  return el;
}

function render_performance() {
  var container = document.getElementById('performance_content');
  container.innerHTML = "";
  if (Times.length === 0) {
    return;
  }

  var speeds = data[5];
  var distances = data[11];
  var powers = data[12];
  var voltages = data[6];
  var watt_hours = data[9];

  var duration = Times[Times.length - 1] - Times[0];
  var distance = array_max(distances) - array_min(distances);
  var energy_used = array_max(watt_hours) - array_min(watt_hours);

  var findings = analyse_performance();
  var problems = findings.filter(function (f) {
    return f.severity === "critical" || f.severity === "warning";
  });
  container.appendChild(performance_heading("Analysis — " + (problems.length ?
    problems.length + " issue" + (problems.length === 1 ? "" : "s") + " found" :
    "no issues found")));
  findings.forEach(function (finding) {
    container.appendChild(render_finding(finding));
  });

  var moving_seconds = 0;
  var moving_speeds = [];
  for (var i = 1; i < Times.length; i++) {
    var elapsed = Times[i] - Times[i - 1];
    // Skip large gaps so merged logs don't inflate moving time.
    if (elapsed > 0 && elapsed < 10 && speeds[i] > 1) {
      moving_seconds += elapsed;
      moving_speeds.push(speeds[i]);
    }
  }

  container.appendChild(performance_heading("Session"));
  container.appendChild(performance_card("Duration", format_duration(duration)));
  container.appendChild(performance_card("Distance", distance.toFixed(2) + " km",
    board_mode === "efoil" ? "from GNSS positions" : "from tachometer"));
  container.appendChild(performance_card("Moving time", format_duration(moving_seconds),
    "above 1 km/h"));
  container.appendChild(performance_card("Samples", Times.length.toString()));

  container.appendChild(performance_heading("Speed (" + names[4] + ")"));
  container.appendChild(performance_card("Top speed", array_max(speeds).toFixed(1) + " km/h"));
  container.appendChild(performance_card("Average moving",
    (moving_speeds.length ? array_mean(moving_speeds) : 0).toFixed(1) + " km/h"));
  container.appendChild(performance_card("Average overall", array_mean(speeds).toFixed(1) + " km/h"));

  container.appendChild(performance_heading("Power and energy"));
  container.appendChild(performance_card("Peak power", array_max(powers).toFixed(0) + " W"));
  container.appendChild(performance_card("Average power", array_mean(powers).toFixed(0) + " W"));
  container.appendChild(performance_card("Energy used", energy_used.toFixed(1) + " Wh"));
  container.appendChild(performance_card("Efficiency",
    distance > 0.01 ? (energy_used / distance).toFixed(1) + " Wh/km" : "—",
    distance > 0.01 ? null : "distance too short"));

  container.appendChild(performance_heading("Battery"));
  container.appendChild(performance_card("Start voltage", voltages[0].toFixed(1) + " V"));
  container.appendChild(performance_card("End voltage", voltages[voltages.length - 1].toFixed(1) + " V"));
  container.appendChild(performance_card("Minimum voltage", array_min(voltages).toFixed(1) + " V",
    "sag " + (array_max(voltages) - array_min(voltages)).toFixed(1) + " V"));
  container.appendChild(performance_card("Peak battery current", array_max(data[3]).toFixed(1) + " A"));

  container.appendChild(performance_heading("Drive"));
  container.appendChild(performance_card("Peak motor current", array_max(data[2]).toFixed(1) + " A"));
  container.appendChild(performance_card("Peak duty cycle", array_max(data[4]).toFixed(0) + " %"));
  container.appendChild(performance_card("Peak controller temp", array_max(data[1]).toFixed(1) + " °C"));
}

function menu_click(e) {
  e.classList.toggle("change");
  if (menu_visible) {
    document.getElementById("menu_list_container").style.visibility = "hidden";
    menu_visible = false;
  } else {
    document.getElementById("menu_list_container").style.visibility = "visible";
    menu_visible = true;
  }
}

function cb_change(e) {
  if (event.target.checked) {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i + 1), { show: true })
    series_shown[i] = true;
  } else {
    var i = names.indexOf(e.target.id.substr(3))
    uplot.setSeries((i + 1), { show: false })
    series_shown[i] = false;
  }
}

function fill_menu() {
  var menu = document.getElementById('menu_list');
  menu.innerHTML = "";

  var file_input = document.getElementById('files');
  if (file_input.parentElement !== document.body) {
    document.body.appendChild(file_input);
  }
  file_input.classList.add('file_picker_input');

  var load_item = document.createElement('li');
  var load_button = document.createElement('button');
  load_button.type = "button";
  load_button.textContent = "Load new log";
  load_button.addEventListener('click', function () {
    document.getElementById('files').click();
  });
  load_item.appendChild(load_button);
  menu.appendChild(load_item);

  var profile_item = document.createElement('li');
  var profile_select = document.createElement('select');
  profile_select.id = "board_mode_menu";
  [["eskate", "E-skateboard"], ["efoil", "Efoil"]].forEach(function (choice) {
    var option = document.createElement('option');
    option.value = choice[0];
    option.textContent = choice[1];
    profile_select.appendChild(option);
  });
  profile_select.value = board_mode;
  profile_select.addEventListener('change', function (e) {
    set_board_mode(e.target.value);
  });
  profile_item.appendChild(profile_select);
  menu.appendChild(profile_item);

  for (var i in names) {
    i = parseInt(i);
    var li = document.createElement('li');

    var checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.id = "cb_" + names[i];
    checkbox.addEventListener('change', cb_change);

    var label = document.createElement('label')
    label.htmlFor = "cb_" + names[i];
    label.appendChild(document.createTextNode(names[i]));

    li.appendChild(checkbox);
    li.appendChild(label);
    menu.appendChild(li);
    if (series_shown[i]) {
      checkbox.checked = true;
      uplot.setSeries((i + 1), { show: true })
    } else {
      checkbox.checked = false;
      uplot.setSeries((i + 1), { show: false });
    }
  }
}

function find_closest_ind(coord) {
  var closest_ind = 0;
  var closest_distance = 9999999;
  for (var i in latlngs) {
    var dist = coord.distanceTo(latlngs[i])
    if (dist < closest_distance) {
      closest_distance = dist;
      closest_ind = i;
    }
  }
  if (closest_distance < 200) {
    return closest_ind;
  }
  return -1;
}

function create_map() {
  map = L.map('mapid').setView(latlngs[0], 13);
  L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoieW94Y3UiLCJhIjoiY2s4c21scW8yMDB6MzNkbndlYXpraTEwdSJ9.VGfekLj7rTAtlifcuD4Buw'
  }).addTo(map);
  var polyline = L.polyline(latlngs, { color: 'red' }).addTo(map);
  // zoom the map to the polyline
  map.fitBounds(polyline.getBounds());

  map.on('mousemove', function (e) {
    var closest_ind = find_closest_ind(e.latlng);
    update_map_popup(closest_ind);
    adjust_plot_pos(closest_ind);
  });
}

function update_map_popup(indx) {
  if (indx != -1 && curr_map_indx != indx) {
    var content = []
    for (var i in series_shown) {
      if (series_shown[i]) {
        content = content.concat([
          names[i],
          ": ",
          parseFloat(data[parseInt(i) + 1][indx]).toFixed(1),
          units[i],
          "<br>"
        ]);
      }
    }
    content.pop()
    if (map_popup == null) {
      map_popup = L.popup()
        .setLatLng(latlngs[indx])
        .setContent(content.join(""))
        .openOn(map);
    } else {
      map_popup.setLatLng(latlngs[indx])
        .setContent(content.join(""))
        .update()
    }
    curr_map_indx = indx;
  }
}

function adjust_plot_pos(indx) {
  if (indx != -1 && curr_plot_indx != indx) {
    var time = Times[indx];
    var curr_plot_indx = indx;
    var view_width = uplot.scales.x.max - uplot.scales.x.min;
    var new_min = time - view_width / 2;
    var new_max = time + view_width / 2;
    if (new_min < Times[0]) {
      new_min = Times[0];
      new_max = new_min + view_width;
    } else if (new_max > Times[Times.length - 1]) {
      new_max = Times[Times.length - 1];
      new_min = new_max - view_width;
    }
    var new_cursor_left = (time - new_min) / (view_width) * uplot.bbox.width;
    uplot.setScale("x", { min: new_min, max: new_max });
    uplot.setCursor({ left: new_cursor_left, top: 0 })
  }
}

function generate_series() {
  var series = [{}];
  for (i in names) {
    var digit = 2;
    switch (names[i]) {
      case "DutyCycle":
      case "Altitude":
      case "Power":
        digit = 0;
    }
    series.push({
      // initial toggled state (optional)
      show: true,
      spanGaps: false,
      // in-legend display
      label: names[i],
      value: (function () {
        var j = i; // j is a copy of i only available to the scope of the inner function
        var digit_save = digit;
        return function (self, rawValue) {
          return rawValue.toFixed(digit_save) + units[j]
        }
      })(),
      scale: units[i],

      // series style
      stroke: colors[i],
      width: 1,
      fill: fill[i],
      dash: [10, 5],
    });
  }
  return series;
}

function generate_axes(show) {
  var axes = [{}]
  for (i in axes_names) {
    //1=right 3=left
    var side = (i % 2) * 2 + 1;
    axes.push(
      {
        show: show,
        scale: axes_names[i],
        values: (function () {
          var j = i; // j is a copy of i only available to the scope of the inner function
          return function (self, ticks) {
            return ticks.map(rawValue => rawValue + axes_names[j]);
          }
        })(),
        side: side,
        grid: { show: false },
      },
    )
  }
  return axes;
}

function generate_scales() {
  var scales = {};
  for (var i in axes_names) {
    var curr_min = 99999
    var curr_max = -99999
    var indxs = getAllIndexes(units, axes_names[i])
    for (var j in indxs) {
      curr_min = Math.min(curr_min, Math.min(...data[indxs[j] + 1]))
      curr_max = Math.max(curr_max, Math.max(...data[indxs[j] + 1]))
    }
    scales[axes_names[i]] = {
      auto: false,
      range: [curr_min, curr_max],
    }
  }
  return scales;
}

function get_window_size() {
  var height = document.getElementById("chart").offsetHeight;
  var width = document.getElementById("chart").offsetWidth;
  var legend = document.getElementsByClassName("legend");
  if (legend.length > 0) {
    height = height - legend[0].offsetHeight;
  } else {
    height = height * 0.8
  }
  // The chart can be rebuilt while its tab is hidden, which reports a zero size.
  return {
    width: width > 0 ? width : window.innerWidth,
    height: height > 0 ? height : Math.round(window.innerHeight * 0.4),
  }
}

function create_chart() {
  var opts = {
    id: "plot",
    class: "chartclass",
    ...get_window_size(),
    plugins: [
      touchZoomPlugin()
    ],
    cursor: {
      y: false,
    },
    series: generate_series(),
    axes: generate_axes(false),
    scales: generate_scales(),
  };

  uplot = new uPlot(opts, data, document.getElementById("chart"));
  document.getElementById("chart").addEventListener("mousemove", e => {
    if (uplot.cursor.idx != null && curr_plot_indx != uplot.cursor.idx) {
      curr_plot_indx = uplot.cursor.idx;
      update_map_popup(curr_plot_indx);
    }
  });
  uplot.setSize(get_window_size());
}

function parse_LogFile(txt, time) {
  var lines = txt.split("\n");
  var values = lines[0].split(",");
  if (values.length > 10) {
    //old ackmaniac fw logs seperated by ,
    for (var i in lines) {
      if (lines[i] != "") {
        if (Times.length == 0) {
          if (i == 0) {
            var settings = lines[i].substr(2).split(",");
            for (var j in settings) {
              var li = document.createElement('li');
              document.getElementById('settings_list').appendChild(li);
              var setting = settings[j].split("=")
              li.innerHTML = ['<strong>', setting[0], '=</strong>', setting[1]].join("");
            }
          } else if (i == 1) {
            base_names = lines[i].split(",")
            //sort out time,faults,elapsedTime,lat,long
            base_names.splice(13, 4);
            base_names.splice(0, 1);
          }
        }
        if (i > 1) {
          var values = lines[i].split(",")

          //DD_MM_YY_HH_MM_SS.sss
          var ts = values[0].split("_")
          values = values.map((item) => {
            return Number(item);
          })
          values[0] = (new Date([ts[2], "-", ts[1], "-", ts[0], "T", ts[3], ":", ts[4], ":", ts[5], "Z"].join(""))).getTime() / 1000;
          if (values[15] != 0 && values[16] != 0) {
            Times.push(values[0]);
            TempPcbs.push(values[1]);
            MotorTemps.push(0);
            MotorCurrents.push(values[2]);
            BatteryCurrents.push(values[3]);
            DutyCycles.push(values[4]);
            Speeds.push(values[5]);
            InpVoltages.push(values[6]);
            AmpHours.push(values[7]);
            AmpHoursCharged.push(values[8]);
            WattHours.push(values[9]);
            WattHoursCharged.push(values[10]);
            Distances.push(values[11]);
            Powers.push(values[12]);
            Faults.push(values[13]);
            TimePassedInMss.push(values[14]);
            latlngs.push([values[15], values[16]]);
            Altitudes.push(values[17]);
            GPSSpeeds.push(values[18]);
            HorizontalAccuracies.push(0);
          } else {
            console.log("found invalid data:\n" + lines[i])
          }
        }
      }
    }
    return
  }
  values = lines[0].split(";");
  if (values.length > 10) {
    filetime = time.getTime()
    starttime = 0
    console.log(filetime, time)
    base_names = [
      "TempPcb",
      "MotorCurrent",
      "BatteryCurrent",
      "DutyCycle",
      "Speed",
      "InpVoltage",
      "AmpHours",
      "AmpHoursCharged",
      "WattHours",
      "WattHoursCharged",
      "Distance",
      "Power",
      "Altitude",
      "GPSSpeed"
    ]
    for (var i in lines) {
      values = lines[i].split(";");
      //ms_today;input_voltage;temp_mos_max;temp_mos_1;temp_mos_2;temp_mos_3;temp_motor;current_motor;
      //current_in;d_axis_current;q_axis_current;erpm;duty_cycle;amp_hours_used;amp_hours_charged;watt_hours_used;
      //watt_hours_charged;tachometer;tachometer_abs;encoder_position;fault_code;vesc_id;d_axis_voltage;q_axis_voltage;
      //ms_today_setup;amp_hours_setup;amp_hours_charged_setup;watt_hours_setup;watt_hours_charged_setup;battery_level;battery_wh_tot;current_in_setup;
      //current_motor_setup;speed_meters_per_sec;tacho_meters;tacho_abs_meters;num_vescs;ms_today_imu;roll;pitch;
      //yaw;accX;accY;accZ;gyroX;gyroY;gyroZ;gnss_posTime;
      //gnss_lat;gnss_lon;gnss_alt;gnss_gVel;gnss_vVel;gnss_hAcc;gnss_vAcc;

      if (lines[i] != "") {
        if (i > 0) {
          values = values.map((item) => {
            return Number(item);
          })
          if (starttime == 0) {
            starttime = values[0]
          }
          // console.log(values);

          if (values[48] != 0 && values[49] != 0) {
            Times.push((filetime + values[0] - starttime) / 1000);
            InpVoltages.push(values[1]);
            TempPcbs.push(values[2]);
            MotorTemps.push(values[6]);
            MotorCurrents.push(values[7]);
            BatteryCurrents.push(values[8]);
            DutyCycles.push(values[12] * 100);
            AmpHours.push(values[13]);
            AmpHoursCharged.push(values[14]);
            WattHours.push(values[15]);
            WattHoursCharged.push(values[16]);
            Speeds.push(values[33] * 3.6);
            Distances.push(values[34] / 1000);
            Powers.push(values[1] * values[8]);
            Faults.push(values[20]);
            TimePassedInMss.push(0);
            latlngs.push([values[48], values[49]]);
            Altitudes.push(values[50]);
            GPSSpeeds.push(values[51] * 3.6);
            HorizontalAccuracies.push(values[53]);
          } else {
            console.log("found invalid data:\n" + lines[i])
          }
        }
      }
    }
  }
}

function append_file_content(files_arr) {
  var done = true;
  for (var i in files_arr) {
    if (files_arr[i].reader.readyState != 2) {
      console.log("not fin");
      done = false;
      break;
    }
  }
  if (done) {
    files_arr.sort(compare_filetimes);
    for (i in files_arr) {
      parse_LogFile(files_arr[i].reader.result, files_arr[i].time)
    }
    compute_gnss_metrics();
    apply_profile();
    create_map();
    create_chart();
    fill_menu();
    show_content();
    show_tab("log");
  }
}

function reset_log_data() {
  stop_playback();
  if (uplot) {
    uplot.destroy();
    uplot = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
  if (overview_plot) {
    overview_plot.destroy();
    overview_plot = null;
  }

  Times = [];
  TempPcbs = [];
  MotorTemps = [];
  MotorCurrents = [];
  BatteryCurrents = [];
  DutyCycles = [];
  Speeds = [];
  InpVoltages = [];
  AmpHours = [];
  AmpHoursCharged = [];
  WattHours = [];
  WattHoursCharged = [];
  Distances = [];
  Powers = [];
  Faults = [];
  TimePassedInMss = [];
  latlngs = [];
  Altitudes = [];
  GPSSpeeds = [];
  VerticalSpeeds = [];
  HorizontalAccuracies = [];
  GnssDistances = [];
  names = [];
  base_names = [];
  data = [];
  document.getElementById("overview_content").replaceChildren();
  document.getElementById("overview_chart").replaceChildren();
  document.getElementById("settings_list").replaceChildren();
  document.getElementById("performance_content").replaceChildren();
}

var files;
function handleFileSelect(evt) {
  reset_log_data();
  show_loader();
  files = Array.from(evt.target.files); // Copy before clearing the input.
  evt.target.value = "";
  var files_arr = []
  // files is a FileList of File objects. List some properties.
  var output = [];
  for (var i = 0, f; f = files[i]; i++) {
    output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
      f.size, ' bytes', '</li>');
    // Only process image files.
    if (!f.type.match('text.*')) {
      handleError("Error Selecting File: Not a text/csv File")
      continue;
    }


    var name_parts = f.name.split(".")[0].split("_");
    var time = (new Date([name_parts[0], "T", name_parts[1].replace(/-/g, ":")].join("")));
    if (isNaN(time.getDate())) {
      time = new Date();
    }
    console.log(time)
    var reader = new FileReader();
    // Closure to capture the file information.
    reader.onload = function (e) {
      append_file_content(files_arr); //todo append
      //parse_LogFile(e.target.result);
    };

    // Read in the image file as a data URL.
    reader.readAsText(f);
    files_arr.push({ time: time, reader: reader });
  }
  //document.getElementById('file_list').innerHTML = '<ul>' + output.join('') +'</ul>';
}

if (window.location.search.length > 1) {
  var args = window.location.search.substr(1).split("&");
  for (i in args) {
    var arg = args[i].split("=");
    switch (arg[0]) {
      case "log":
        get_Log(arg[1]);
        break;
      default:
        show_upload();
    }
  }
} else {
  show_upload();
}
set_board_mode(board_mode);
document.getElementById('files').addEventListener('change', handleFileSelect, false);
document.getElementById('board_mode').addEventListener('change', function (event) {
  set_board_mode(event.target.value);
});
document.getElementById('playback_toggle').addEventListener('click', toggle_playback);
document.getElementById('playback_restart').addEventListener('click', restart_playback);
document.getElementById('playback_speed').addEventListener('change', function (event) {
  playback_speed = parseFloat(event.target.value);
});
window.addEventListener("resize", throttle(() => {
  if (uplot) {
    uplot.setSize(get_window_size());
  }
  if (overview_plot) {
    overview_plot.setSize({
      width: document.getElementById("overview_chart").offsetWidth - 36,
      height: 300,
    });
  }
}, 100));
