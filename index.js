/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @ptvgroup/linguijs/string-is-marked-for-translation */
/* eslint-disable no-prototype-builtins */
const api_key = "YOUR_API_KEY";

const units = {
  fuelConsumption: "kg",
  co2eTankToWheel: "kg",
  co2eWellToWheel: "kg",
  energyUseTankToWheel: "MJ",
  energyUseWellToWheel: "MJ",
  electricityConsumption: "kWh",
};

$(document).ready(function () {
  let profiles = [];
  const coordinate = L.latLng(49, 8.4);
  const map = new L.Map("map", {
    center: coordinate,
    zoom: 13,
    zoomControl: false,
  });
  L.control
    .zoom({
      position: "bottomright",
    })
    .addTo(map);
  const tileLayer = new L.tileLayer(
    "https://api.myptv.com/rastermaps/v1/image-tiles/{z}/{x}/{y}?size={tileSize}",
    {
      attribution: "© " + new Date().getFullYear() + ", PTV Group, HERE",
      tileSize: 256,
      trackResize: false,
    },
    [{ header: "ApiKey", value: api_key }]
  ).addTo(map);
  map.on("click", onMapClick);

  fetch(
    "https://api.myptv.com/data/v1/vehicle-profiles/predefined",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apiKey: api_key,
      },
    }
  )
    .then((res, err) => {
      return res.json();
    })
    .then((res, err) => {
      if (err) {
        console.log(err);
      } else {
        profiles = res.profiles.filter((p) => {
          return p.name != "PEDESTRIAN" && p.name != "BICYCLE";
        });
        addControls();
      }
    });

  addSummaryControl();
  addEmissionsResultControl();
  addDescriptionBanner();

  function onMapClick(e) {
    const marker = L.marker(e.latlng).addTo(map);
    marker.on("contextmenu", removeMarker);
    calculateRoute();
  }
  function removeMarker(e) {
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer._latlng === e.latlng) {
        layer.remove();
      }
    });
    calculateRoute();
  }
  function fetchRoute() {
    if (document.getElementById("emissionProfile").value.includes("HBEFA")) {
      document.getElementById("averageFuelConsumption").disabled = true;
      document.getElementById("fuelType").disabled = true;
      document.getElementById("fuelTypeLabel").textContent =
        "Fuel Type, not supported with HBEFA";
      document.getElementById("averageFuelConsumptionLabel").textContent =
        "Fuel Consumption (l / 100km), taken from HBEFA";
    } else {
      const profileName = document.getElementById("vehicleProfile").value;
      const profile = profiles.find((e) => {
        return e.name === profileName;
      });
      document.getElementById("fuelTypeLabel").textContent = "Fuel Type";
      document.getElementById("averageFuelConsumptionLabel").textContent =
        "Fuel Consumption (l / 100km)";
      if (
        profile?.vehicle?.fuelType &&
        profile?.vehicle?.averageFuelConsumption
      ) {
        document.getElementById("averageFuelConsumption").disabled = false;
        document.getElementById("fuelType").disabled = false;
        document.getElementById("fuelType").value = profile.vehicle.fuelType;
        document.getElementById("averageFuelConsumption").value =
          profile.vehicle.averageFuelConsumption;
      } else {
        document.getElementById("averageFuelConsumption").disabled = true;
        document.getElementById("fuelType").disabled = true;
      }
    }
    calculateRoute();
  }

  function calculateRoute() {
    const waypoints = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        waypoints.push(layer._latlng);
      }
    });
    if (waypoints.length > 1) {
      fetch(
        "https://api.myptv.com/routing/v1/routes" +
          getQuery(waypoints),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            apiKey: api_key,
          },
        }
      ).then((response) =>
        response.json().then((result) => {
          clearResults();
          displayPolyline(JSON.parse(result.polyline));
          displayResults(result);
        })
      );
    } else {
      clearResults();
    }
  }

  function getQuery(waypoints) {
    let query = "?results=POLYLINE";

    const results = [];

    results.push(document.getElementById("emissionProfile").value);

    if (results.length > 0) {
      query += "," + results.join();
    }

    query += "&profile=" + document.getElementById("vehicleProfile").value;
    query +=
      "&vehicle[averageElectricityConsumption]=" +
      document.getElementById("averageElectricityConsumption").value;
    query +=
      "&vehicle[engineType]=" + document.getElementById("engineType").value;
    query +=
      "&vehicle[electricityType]=" +
      document.getElementById("electricityType").value;
    query +=
      "&vehicle[dualFuelRatio]=" +
      document.getElementById("dualFuelRatio").value;
    query +=
      "&vehicle[emissionStandard]=" +
      document.getElementById("emissionStandards").value;
    query +=
      "&vehicle[bioFuelRatio]=" + document.getElementById("bioFuelRatio").value;
    query +=
      "&vehicle[hybridRatio]=" + document.getElementById("hybridRatio").value;
    if (!document.getElementById("emissionProfile").value.includes("HBEFA")) {
      query +=
        "&vehicle[averageFuelConsumption]=" +
        document.getElementById("averageFuelConsumption").value;
      query +=
        "&vehicle[fuelType]=" + document.getElementById("fuelType").value;
    }

    waypoints.forEach((waypoint) => {
      query += "&waypoints=" + waypoint.lat + "," + waypoint.lng;
    });
    return query;
  }

  function clearPolyline() {
    if (polylineLayer !== null) {
      map.removeLayer(polylineLayer);
    }
  }

  var polylineLayer = null;
  function displayPolyline(polyline) {
    const myStyle = {
      color: "#2882C8",
      weight: 5,
      opacity: 0.65,
    };

    polylineLayer = L.geoJSON(polyline, {
      style: myStyle,
    }).addTo(map);

    map.fitBounds(polylineLayer.getBounds());
  }
  function displayResults(result) {
    displaySummary(result);

    Object.keys(result.emissions).forEach((key) => {
      displayEmissions(result.emissions[key]);
    });
  }

  function displayEmissions(emissions) {
    const table = document.createElement("table");
    table.id = "emissionsReportTableWrapper";
    const thead = document.createElement("thead");
    thead.innerHTML = `        
        <tr>
            <td>Type</td>
            <td>Amount</td>
        </tr>`;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const key in emissions) {
      if (emissions.hasOwnProperty(key)) {
        const tr = document.createElement("tr");
        const th = document.createElement("td");
        th.textContent = key;
        const td = document.createElement("td");
        td.textContent = `${emissions[key].toFixed(4)} ${units[key]}`;
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    document.getElementById("emissionsReportTableWrapper").appendChild(table);
  }

  function clearResults() {
    clearPolyline();
    document.getElementById("emissionsReportTableWrapper").innerHTML = "";
    $("#summaryTable").empty();
  }
  function getRow(columns) {
    let row = "";
    columns.forEach((col) => {
      row += "<td>" + col + "</td>";
    });
    return "<tr>" + row + "</tr>";
  }

  function displaySummary(result) {
    $("#summaryTable").append(
      $.parseHTML(getRow(["Distance", convertDistance(result.distance)]))
    );
    $("#summaryTable").append(
      $.parseHTML(getRow(["Travel Time", convertTime(result.travelTime)]))
    );
  }

  function addControls() {
    const routingControl = L.control({ position: "topleft" });
    routingControl.onAdd = function (map) {
      const div = L.DomUtil.create("div", "routing-control");
      const html = `
            <h2>Emission Routing</h2>
            <div>
                <div>
                    <label for="emissionProfile" style="display: block;">Emission Profile</label>
                    <select name="emissionProfile" id="emissionProfile" style="display: block; width: 100%;">
                        <option value="EMISSIONS_ISO14083_2022">ISO14083_2022_EUROPE</option>
                        <option value="EMISSIONS_ISO14083_2022_DEFAULT_CONSUMPTION">ISO14083_2022_DEFAULT_CONSUMPTION</option>                    
                        <option value="EMISSIONS_EN16258_2012">EN16258_2012</option>
                        <option value="EMISSIONS_EN16258_2012_HBEFA">EN16258_2012_HBEFA</option>
                        <option value="EMISSIONS_FRENCH_CO2E_DECREE_2017_639">FRENCH_CO2E_DECREE_2017_639</option>
                    </select>
                </div>
                <div>
                    <label for="vehicleProfile" style="display: block;">Vehicle Profile</label>
                    <select name="vehicleProfile" id="vehicleProfile" style="display: block; width: 100%;">
                        ${profiles.map((profile) => {
                          return `<option value="${profile.name}">${profile.name}</option>`;
                        })}
                    </select>
                </div>
                <div>
                    <label for="engineType" id="engineTypeLabel" style="display: block;">Fuel Type</label>
                    <select name="engineType" id="engineType" style="display: block; width: 100%;">
                        <option value="COMBUSTION">COMBUSTION</option>
                        <option value="HYBRID">HYBRID</option>
                        <option value="ELECTRIC">ELECTRIC</option>
                    </select>
                </div>
                <div>
                    <label for="fuelType" id="fuelTypeLabel" style="display: block;">Fuel Type</label>
                    <select name="fuelType" id="fuelType" style="display: block; width: 100%;">
                        <option value="DIESEL">DIESEL</option>
                        <option value="GASOLINE">GASOLINE</option>
                        <option value="COMPRESSED_NATURAL_GAS">COMPRESSED_NATURAL_GAS</option>
                        <option value="LIQUEFIED_PETROLEUM_GAS">LIQUEFIED_PETROLEUM_GAS</option>
                        <option value="LIQUEFIED_NATURAL_GAS">LIQUEFIED_NATURAL_GAS</option>
                        <option value="CNG_GASOLINE">CNG_GASOLINE</option>
                        <option value="LPG_GASOLINE">LPG_GASOLINE</option>
                        <option value="ETHANOL">ETHANOL</option>
                        <option value="NONE">NONE</option>
                    </select>
                </div>
                <div>
                  <label for="emissionStandards" id="emissionStandardsLabel" style="display: block;">Emission standards</label>
                  <select name="emissionStandards" id="emissionStandards" style="display: block; width: 100%;">
                      <option value="EURO_0">EURO_0</option>
                      <option value="EURO_1">EURO_1</option>
                      <option value="EURO_2">EURO_2</option>
                      <option value="EURO_3">EURO_3</option>
                      <option value="EURO_4">EURO_4</option>
                      <option value="EURO_5">EURO_5</option>
                      <option value="EURO_EEV">EURO_EEV</option>
                      <option value="EURO_6" selected>EURO_6</option>
                      <option value="EURO_6C">EURO_6C</option>
                      <option value="EURO_6D_TEMP">EURO_6D_TEMP</option>
                      <option value="EURO_6D">EURO_6D</option>
                      <option value="EURO_6E">EURO_6E</option>
                      <option value="EURO_7">EURO_7</option>
                      <option value="NONE">NONE</option>
                      <option value="">NoValue</option>
                  </select>
                </div>
                <div>
                    <label for="electricityType" id="electricityTypeLabel" style="display: block;">Electricity Type</label>
                    <select name="electricityType" id="electricityType" style="display: block; width: 100%;">
                    <option value="BATTERY">BATTERY</option>
                    <option value="HYDROGEN_FUEL_CELL">HYDROGEN_FUEL_CELL</option>
                    <option value="NONE">None</option>
                    </select>
                </div>
                <div>
                    <label for="averageFuelConsumption" id="averageFuelConsumptionLabel" style="display: block;">Fuel Consumption (l / 100km)</label>
                    <input type="number" id="averageFuelConsumption" name="averageFuelConsumption" style= "width: 100%;"
                    min="1" step="1" value="15" max="100">
                </div>
                <div>
                    <label for="averageElectricityConsumption" id="averageElectricityConsumptionLabel" style="display: block;">Electric Consumption (kWh / 100km)</label>
                    <input type="number" id="averageElectricityConsumption" name="averageElectricityConsumption" style= "width: 100%;"
                    min="1" step="1" value="15" max="100">
                </div>
                <div>
                    <label for="bioFuelRatio" id="bioFuelRatioLabel" style="display: block;">Bio fuel ratio [0..100]</label>
                    <input type="number" id="bioFuelRatio" name="bioFuelRatio" style= "width: 100%;"
                    min="1" step="1" value="0" max="100">
                </div>
                <div>
                    <label for="dualFuelRatio" id="dualFuelRatioLabel" style="display: block;">Dual fuel ratio [1..99]</label>
                    <input type="number" id="dualFuelRatio" name="dualFuelRatio" style= "width: 100%;"
                    min="1" step="1" value="1" max="99">
                </div>
                <div>
                    <label for="hybridRatio" id="hybridRatioLabel" style="display: block;">Hybrid ratio [1..99]</label>
                    <input type="number" id="hybridRatio" name="hybridRatio" style= "width: 100%;"
                    min="1" step="1" value="1" max="99">
                </div>
            </div>
    `;
      div.innerHTML = html;

      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);

      return div;
    };
    routingControl.addTo(map);
    document
      .getElementById("emissionProfile")
      .addEventListener("change", fetchRoute);
    document
      .getElementById("vehicleProfile")
      .addEventListener("change", fetchRoute);
    document
      .getElementById("engineType")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("fuelType")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("emissionStandards")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("electricityType")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("averageFuelConsumption")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("averageElectricityConsumption")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("dualFuelRatio")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("bioFuelRatio")
      .addEventListener("change", calculateRoute);
    document
      .getElementById("hybridRatio")
      .addEventListener("change", calculateRoute);
  }

  // UI controls
  function addSummaryControl() {
    const summaryControl = L.control({ position: "topright" });
    summaryControl.onAdd = function (map) {
      const div = L.DomUtil.create("div", "summary-control");
      const html = `
            <h2>Summary</h2>
            <div id="summaryTableWrapper">
                <table id="summaryTable"></table>
            </div>
        `;
      div.innerHTML = html;

      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);

      return div;
    };
    summaryControl.addTo(map);
  }

  function addEmissionsResultControl() {
    const resultControl = L.control({ position: "topright" });
    resultControl.onAdd = function (map) {
      const div = L.DomUtil.create("div", "result-control-left");
      const html = `
            <h2>Emissions</h2>
            <div id="emissionsReportTableWrapper">
                <table id="emissionsCostsTable"></table>
            </div>
        `;
      div.innerHTML = html;

      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);

      return div;
    };
    resultControl.addTo(map);
  }

  function addDescriptionBanner() {
    const banner = L.control({ position: "bottomleft" });
    banner.onAdd = function (map) {
      const div = L.DomUtil.create("div", "banner");
      const html = `
            <p>
                Left click to add waypoints and right click to remove them.<br>
                The waypoint order is determined by the order of their creation.
            </p>
        `;
      div.innerHTML = html;

      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);

      return div;
    };
    banner.addTo(map);
  }
});
