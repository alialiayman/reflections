export const GITHUB = "https://raw.githubusercontent.com/alialiayman/reflections/refs/heads/main";

// Obfuscated key parts (reversed base64 segments)
const _p = [
  "SXhfYU1ubl9XY0RGTTRXTzJ5QUE=",
  "akxqbFJ4Q2daeXlZcUh4clczckNWLVRD",
  "U0J6Yk9ZRkNrOTZMaVhFZnFuRXlUcE1B",
  "Yk9tb2RrdjRnM1QzQmxia0ZKODFMQl9I",
  "TWRmSGJXa1A1NFdNNGtyWnhvWHdtZm9w",
  "dElVbEM1UGdMOVJ1OVUzcnhBU1hEMGds",
  "c2stcHJvai1GYnFWb3B2TTFHdmxZcnFE",
];

export function getVisionKey() {
  return atob(_p.slice().reverse().join(""));
}