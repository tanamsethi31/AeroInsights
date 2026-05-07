import DottedMap from "dotted-map";
try {
  const map = new DottedMap({ height: 100, grid: "diagonal" });
  console.log("Success");
} catch(e) {
  console.log(e);
}
