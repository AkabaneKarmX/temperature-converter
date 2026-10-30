const temperatureValue = document.getElementById("temperatureValue");
const submitButton = document.getElementById("submitButton");
const resetButton = document.getElementById("resetButton");
const tempValue = document.getElementById("tempValue");

const celsiusToKelvin = (celsius) => celsius + 273.15;

const celsiusToFahrenheit = (celsius) => (celsius * 9) / 5 + 32;

const kelvinToFahrenheit = (kelvin) => ((kelvin - 273.15) * 9) / 5 + 32;

const fahrenheitToKelvin = (fahrenheit) => ((fahrenheit - 32) * 5) / 9 + 273.15;

// Formats the result with the matching unit label.
const formatTemperature = (value, unit) => {
  const formatted = value.toLocaleString("en-GB", {
    style: "unit",
    unit: unit === "F" ? "fahrenheit" : "celsius",
    unitDisplay: "short",
    maximumFractionDigits: 2,
  });

  if (unit === "K") {
    return formatted.replace("°C", " K");
  }

  return formatted;
};

submitButton.addEventListener("click", () => {
  const input = temperatureValue.value.trim();
  const temperature = Number(input);

  if (input === "" || Number.isNaN(temperature)) {
    alert("Please enter a numerical value.");
    return;
  }

  if (document.getElementById("celsiusToKelvin").checked) {
    tempValue.textContent = formatTemperature(celsiusToKelvin(temperature), "K");
  } else if (document.getElementById("celsiusToFahrenheit").checked) {
    tempValue.textContent = formatTemperature(celsiusToFahrenheit(temperature), "F");
  } else if (document.getElementById("kelvinToFahrenheit").checked) {
    tempValue.textContent = formatTemperature(kelvinToFahrenheit(temperature), "F");
  } else if (document.getElementById("fahrenheitToKelvin").checked) {
    tempValue.textContent = formatTemperature(fahrenheitToKelvin(temperature), "K");
  }
});

resetButton.addEventListener("click", () => {
  temperatureValue.value = "";
  tempValue.textContent = "";
  document.getElementById("celsiusToKelvin").checked = true;
});
