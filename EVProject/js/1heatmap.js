const width = 960;
const height = 300;

const svg = d3.select("#heatmap")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const projection = d3.geoMercator()
  .scale(90)
  .translate([width / 2, height / 1.5]);

const path = d3.geoPath().projection(projection);

const colorScale = d3.scaleSequential(d3.interpolateYlGnBu)
  .domain([0, 1]); // placeholder

const yearSlider = d3.select("#yearSlider");
const yearLabel = d3.select("#yearLabel");
const startButton = d3.select("#startAnimation");

let geoData;
let salesData = new Map();
let countries;
const minYear = 2010;
const maxYear = 2024;
let currentYear = minYear;
let animationInterval;

const marginStack = { top: 60, right: 40, bottom: 40, left: 40 },
  widthStack = 600 - marginStack.left - marginStack.right,
  heightStack = 80;

const svgStack = d3.select("#heatmap")
  .append("svg")
  .attr("width", widthStack + marginStack.left + marginStack.right)
  .attr("height", heightStack + marginStack.top + marginStack.bottom)
  .append("g")
  .attr("transform", `translate(${marginStack.left},${marginStack.top})`);

const xStack = d3.scaleLinear().range([0, widthStack]);
// const colors = d3.scaleOrdinal(d3.schemeSet3);
const colors = d3.scaleOrdinal(d3.schemePaired);

// Load data
Promise.all([
  d3.csv("datasets/EVWorldSales.csv"),
  d3.json("datasets/world.geojson")
]).then(([csv, geojson]) => {
  geoData = geojson;

  csv.forEach(d => {
    const country = d.region_country.trim();
    const years = {};
    Object.keys(d).forEach(k => {
      if (k !== "region_country") {
        years[k.trim()] = +d[k].replace(/,/g, '').trim() || 0;
      }
    });
    salesData.set(country, years);
  });

  countries = svg.append("g")
    .selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5);

  updateHeatmap(currentYear);
  initStackedBar();
  updateStackedBar(currentYear);

  yearSlider.on("input", function() {
    currentYear = +this.value;
    yearLabel.text(currentYear);
    updateHeatmap(currentYear);
    updateStackedBar(currentYear);
  });

  addLegend();
}).catch(console.error);

// === Update heatmap ===
function updateHeatmap(year) {
  const values = [];
  salesData.forEach(years => {
    if (years[year]) values.push(years[year]);
  });
  const maxSales = d3.max(values) || 1;
  colorScale.domain([0, maxSales]);

  countries.transition().duration(500)
    .attr("fill", d => {
      const sales = salesData.get(d.properties.name)?.[year] || 0;
      return sales > 0 ? colorScale(sales) : "#eee";
    });

  countries.select("title").remove();
  countries.append("title")
    .text(d => {
      const sales = salesData.get(d.properties.name)?.[year] || 0;
      return `${d.properties.name}: ${sales.toLocaleString()}`;
    });
}

//  Legend 
const margin = { left: 20, right: 20, top: 0, bottom: 20 };
const legendWidth = 300;
const legendHeight = 10;

function addLegend() {
  const legendSvg = d3.select("#heatmap-legend")
    .append("svg")
    .attr("width", legendWidth + margin.left + margin.right)
    .attr("height", legendHeight + margin.top + margin.bottom);

  const defs = legendSvg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "linear-gradient");

  linearGradient.selectAll("stop")
    .data(colorScale.ticks().map((t, i, n) => ({
      offset: `${100 * i / n.length}%`,
      color: colorScale(t)
    })))
    .enter().append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);

  legendSvg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#linear-gradient)");

  const legendScale = d3.scaleLinear()
    .domain(colorScale.domain())
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat(d3.format(".2s"));

  legendSvg.append("g")
    .attr("transform", `translate(${margin.left}, ${legendHeight + margin.top})`)
    .call(legendAxis);
}

//  Animation 
startButton.on("click", () => {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
    startButton.text("Start Animation");
  } else {
    animationInterval = setInterval(() => {
      currentYear++;
      if (currentYear > maxYear) currentYear = 2024
      yearSlider.property("value", currentYear);
      yearLabel.text(currentYear);
      updateHeatmap(currentYear);
      updateStackedBar(currentYear);
    }, 1000);
    startButton.text("Stop Animation");
  }
});

//  Init stacked bar once 
function initStackedBar() {
  svgStack.append("text")
    .attr("class", "stack-title")
    .attr("x", widthStack / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("fill", "#fff")
    .style("font-size", "16px");

  // Create static legend for 5 slots
  const exampleKeys = ["Top1", "Top2", "Top3", "Top4", "Others"];
  colors.domain(exampleKeys);

  const legendGroup = svgStack.append("g").attr("class", "legend-group");

  exampleKeys.forEach((label, i) => {
    const g = legendGroup.append("g")
      .attr("transform", `translate(${i * 100}, ${heightStack / 2 + 20})`);
    g.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", colors(label));
    g.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("fill", "#fff")
      .attr("class", `legend-text-${i}`);
  });
}

// Update stacked bar
function updateStackedBar(year) {
  let data = Array.from(salesData.entries())
    .filter(([country]) => country.toLowerCase() !== "world")
    .map(([country, years]) => ({
      country: country === "United Kingdom" ? "UK" : country,
      sales: years[year] || 0
    }))
    .sort((a, b) => b.sales - a.sales);

  const top5 = data.slice(0, 4);
  const othersSum = d3.sum(data.slice(4), d => d.sales);
  const stackData = [...top5, { country: "Others", sales: othersSum }];

  const total = d3.sum(stackData, d => d.sales);
  xStack.domain([0, total]);

  let cumulative = 0;
  stackData.forEach(d => {
    d.x0 = cumulative;
    d.x1 = cumulative + d.sales;
    cumulative = d.x1;
  });

  const rects = svgStack.selectAll("rect.segment")
    .data(stackData, d => d.country);

  rects.enter()
    .append("rect")
    .attr("class", "segment")
    .attr("y", 0)
    .attr("height", heightStack / 2)
    .attr("fill", d => colors(d.country))
    .merge(rects)
    .transition()
    .duration(500)
    .attr("x", d => xStack(d.x0))
    .attr("width", d => xStack(d.sales));

  rects.exit().remove();

  // Numbers
  const numbers = svgStack.selectAll("text.number")
    .data(stackData, d => d.country);

  numbers.enter()
    .append("text")
    .attr("class", "number")
    .attr("y", heightStack / 4)
    .attr("dy", ".35em")
    .style("fill", "#fff")
    .style("font-size", "12px")
    .merge(numbers)
    .transition()
    .duration(500)
    .attr("x", d => xStack(d.x0) + xStack(d.sales) / 2)
    .style("text-anchor", "middle")
    .text(d => d3.format(",")(d.sales))
    .style("opacity", d => xStack(d.sales) < 30 ? 0 : 1);

  numbers.exit().remove();

  // Update static legend colors & text
  stackData.forEach((d, i) => {
    svgStack.select(`.legend-group g:nth-child(${i + 1}) rect`)
      .attr("fill", colors(d.country));
    svgStack.select(`.legend-text-${i}`).text(d.country);
  });

  svgStack.select(".stack-title")
    .text(`Countries Leading the EV Arm Race in ${year}`);
}
