// Hi, writing this in case it ever goes open source (which is the plan)
// A warning before you proceed, I'm very bad at commenting. I've tried my best to try keep this code as clean and comprehensible as possible but no guarantees
// Most of the code is still uncommented. If you need to understand an uncommented section please ask me and I'll comment it. I'll also be adding more as development continues
// Good luck brave warrior

// options variable for later on
var options = {
	gameLabel: true
};

// Split up the file into multiple files containing similar functions, to make everything less cluttered. I really tried with this but it's harder than I thought so I have no idea if it really helped.
const analyser                         = require('./analyser.js');
const gui                              = require('./gui.js');

// Dependencies, sorted in decending order of line length because it looks neater
const winscreen											= require('electron').remote.screen;
const xml2js											= require('xml2js').parseString;
const { dialog, getCurrentWindow}						= require('electron').remote;
const { shell, ipcRenderer, webFrame }					= require('electron');
const request											= require('request');
const semVer											= require('semver');
const path												= require('path');
const fs												= require('fs');

const saveLocation = process.env.APPDATA + "\\splitsAnalyser\\";

// Version
const version = "0.4.1";
d3.select("#versionNumber").text(version); //set the version text to the correct number
d3.select("#titleVersionNumber").text(version); //set the version text to the correct number

// Set window title
document.title = `SplitsAnalyser v${version}`;

// Speedrun.com api results stored in here. Only updated on program launch.
var src = {};

// Variables for keeping track of which tabs are currently selected on the left side menu
var split_HasFocus = null;
var game_HasFocus = null;

// Keep track of what split sorting method is used
var currSort = null;

// Stores last selected split per game
var split_lastFocus = {};

// Keep track of current window location and size
var winBounds = {};

// Main object in which the splits are stored
var splits = {};

// Making the graph building function globally accessible
// Should probably not do this but I haven't looked into another way of having it accessible to the pb only button yet.
var buildGraph;

// drag drop importing
let dragdropDiv = document.getElementById("dragdropDiv");

// Make the dragdrop elements do their stuff when dragging a file over the window
document.ondragover = (event) => {
	d3.select("#dragdropSpan").style("opacity", "1");
	d3.select("#dragdropDiv").style("opacity", "0.8")
		.style("pointer-events", "all");
	event.preventDefault();
};

// Return dragdrop elements to normal after leaving window
dragdropDiv.ondragleave = (event) => {
	d3.select("#dragdropSpan").style("opacity", "0");
	d3.select("#dragdropDiv").style("opacity", "0")
		.style("pointer-events", "none");
	event.preventDefault();
};

// Import the files when they're dropped in the window
dragdropDiv.ondrop = (event) => {
	event.preventDefault();
	d3.select("#dragdropSpan").style("opacity", "0");
	d3.select("#dragdropDiv").style("opacity", "0")
		.style("pointer-events", "none");
	
	for (let i of event.dataTransfer.files) {
		if (i.path.endsWith(".lss")) {
			importSplitFile(i.path);
		}
	}

};

// handle new window bounds when window is changed and main process sends over getbounds event.
ipcRenderer.on('getBounds', (event, arg) => {
	if (winscreen.getDisplayNearestPoint({x: arg.x + 8, y: arg.y + 8}).workAreaSize.width < 1920) {
		webFrame.setZoomFactor(winscreen.getDisplayNearestPoint({x: arg.x + 8, y: arg.y + 8}).workAreaSize.width / 1920);
	} else {
		webFrame.setZoomFactor(1);
	}
	winBounds = arg;
	saveProgramState();
});

// Keyboard shortcuts, woo!
// Most of these just execute the onclick function of the action the shortcut replaces
window.addEventListener('keyup', (event) => { 
	// console.log(event); // for adding new shortcuts. Uncomment if you want to do that
	let node;

	// Simplifying the variables
	let ctrl = event.ctrlKey;
	let shift = event.shiftKey;
	switch (event.key) {
		case "F2":
			d3.select(".splitActive").select(".splitName").node().onclick();
		break;
		case "Escape":
			if (d3.select("#settingsContainer").style("opacity")) {
				gui.closeSettings();
			}
		break;

		case "ArrowUp":
			node = d3.select(".splitActive").node();
			if (node.previousSibling) {
				node.previousSibling.onclick();
			}
		break;
		case "ArrowDown":
			node = d3.select(".splitActive").node();
			if (node.nextSibling) {
				node.nextSibling.onclick();
			}
		break;

		case "Tab":
			if (ctrl) {
				node = d3.select(".gameActive").node().parentElement;
				if (shift) {
					if (node.previousSibling) {
						node.previousSibling.firstElementChild.onclick();
					}
				} else {
					if (node.nextSibling && node.nextSibling.firstElementChild.tagName === "IMG") {
						node.nextSibling.firstElementChild.onclick();
					}
				}
			}
		break;

		case "p":
			d3.select("#splitsGraphSet").select("input").node().onclick();
		break;

		case "n":
			if (ctrl) {
				uploadSplits();
			}
		break;

		case "Delete":
			d3.select(".splitActive").select("svg").select("use").node().onclick();
		break;

		case "c":
			for (let i = 0; i < Object.keys(splits[game_HasFocus].runs[split_HasFocus.substring(split_HasFocus.indexOf("_") + 1)].segments).length; i++) {
				d3.select(".th" + i).node().onclick();
			}
		break;


	}
}, true); // True to make sure this eventlisterener is the first function that gets the events

// New Status bar events
// This handles the minimize button
document.getElementById("minimizeButton").addEventListener('click', () =>{
	getCurrentWindow().minimize();
});
// This handles the Min Max button
document.getElementById("minMaxButton").addEventListener('click', () =>{
	if(getCurrentWindow().isMaximized()){
		getCurrentWindow().unmaximize();
	}
	else{
		getCurrentWindow().maximize();
	}
});
// This handles the Close button
document.getElementById("closeButton").addEventListener('click', () =>{
	getCurrentWindow().close();
});

// putting objects into arrays in case there's only one entry, in which case it isn't in an array and breaks all the code
function convertToSingleArray(obj) {
	if (!Array.isArray(obj)) {
		return [obj];
	}
	return obj;
}

// Delete the split
function deleteSplit(split, game, preconfirm = false) {
	if (!preconfirm) { // to make sure auto deleting of splits doesn't trigger the delete prompt.
		if (!window.confirm("Are you sure you want to delete this split?\n\nPress OK to delete or Cancel to cancel.")) { return; }
	}
	delete splits[game].runs[split];
	splitMenu(null);
	if (!Object.keys(splits[game].runs).length) {
		delete splits[game];
		gui.removeGame(game);
		game_HasFocus = null;
		gameMenu(null);
	}
	refreshSplitsList(currSort);
	saveSplits();
}

function uploadSplits() {
	let path = dialog.showOpenDialog({
		title: "Choose a splits file to upload.",
		filters: [{name: "LSS file", extensions: ['lss']}],
		properties: ['openFile', 'multiSelections']
	});

	if (!path) { return; } // return if open dialog was cancelled.

	for (let i in path) {
		importSplitFile(path[i]);
	}
}


function splitMenu(select) {
	if (!select || select === split_HasFocus) {
		if (select) {
			d3.select("#" + select).attr("class", "split splitInactive");
		}
		split_HasFocus = null;
		analysis(null);
		return;
	}

	if (!splits[select.substring(0, select.indexOf("_"))] || !splits[select.substring(0, select.indexOf("_"))].runs[select.substring(select.indexOf("_") + 1)]) { return; }

	if (splits[select.substring(0, select.indexOf("_"))].runs[select.substring(select.indexOf("_") + 1)].new) {
		splits[select.substring(0, select.indexOf("_"))].runs[select.substring(select.indexOf("_") + 1)].new = false;
		d3.select("#" + select).select(".new").remove();
		saveSplits();
	}

	d3.select("#" + select).attr("class", "split splitActive");
	d3.select("#" + split_HasFocus).attr("class", "split splitInactive");
	split_HasFocus = select;
	analysis(select);
	saveProgramState();
}

// Function for returning a dynamic sorting function
function splitsSortBy(sort) {
	return function(a, b) {
		// Simplifying the variables
		a = a[1];
		b = b[1];

		switch (sort) {
			case "ByName":
				a = a.name.toLowerCase();
				b = b.name.toLowerCase();
			break;
			case "ByCategory":
				a = a.category.toLowerCase();
				b = b.category.toLowerCase();
			break;
			case "ByTime":
				a = a.pb[0];
				b = b.pb[0];
			break;
		}

		if (a < b) {
			return -1;
		}

		if (a > b) {
			return 1;
		}

		return 0;
	};
}

function refreshSplitsList(sortBy) {
	if (!game_HasFocus) {
			d3.select("#splitsList").transition().duration(150).ease(d3.easeLinear).style("opacity", "0");
			d3.select("#selectAGame").transition().duration(70).ease(d3.easeLinear).style("opacity", "1");
	} else {
		if (!sortBy) { sortBy = "ByName"; }
		currSort = sortBy;
		d3.select("#sortedBy").text(sortBy.replace("By", ""));

		d3.select("#selectAGame").transition().duration(70).ease(d3.easeLinear).style("opacity", "0");
		d3.select("#splitsList").html("");
		let runs = Object.entries(splits[game_HasFocus].runs).sort(splitsSortBy(sortBy));

		for (let i in runs) {
			let split = d3.select("#splitsList")
				.append("div").attr("class", "split splitInactive").attr("onclick", `splitMenu('${game_HasFocus.toLowerCase()}_${runs[i][0]}')`).attr("id", game_HasFocus.toLowerCase() + "_" + runs[i][0]);
			split.append("span").text(runs[i][1].name).attr("class", "splitName")
				.attr("onclick", "renameSplit(" + runs[i][0] + ", '" + game_HasFocus + "')")
				.attr("title", "Rename split"); // Name
			let svg = split.append("svg").attr("class", "icon")
				.attr("preserveAspectRatio", "none")
				.attr("viewBox", "0 0 24 24");
			svg.append("title").text("Delete split");
			svg.append("use").attr("href", "#icon_delete").attr("onclick", "deleteSplit(" + runs[i][0] + ", '" + game_HasFocus + "')");
			if (runs[i][1].new) {
				split.append("span").text("NEW").attr("class", "new");
			}
			split.append("span").text(runs[i][1].category).attr("class", "splitCategory"); // category
			split.append("span").text(runs[i][1].file).attr("class", "splitFile"); // File name
			split.append("span").text(analyser.timeFormat(runs[i][1].pb[0])).attr("class", "splitTime"); // pb time
			// split.append("span").text(splits[game_HasFocus].runs[i].avgstddev).attr("class", "splitTimeDev");
		}
		d3.select("#splitsList").transition().duration(150).ease(d3.easeLinear).style("opacity", "1");
		d3.select("#" + split_HasFocus).attr("class", "split splitActive");
	}
}

function gameMenu(select) {
	analysis(null);
	if (select) {
		split_lastFocus[game_HasFocus] = split_HasFocus;
	}
	if (!select || select === game_HasFocus) {
		if (select) {	
			d3.select("#" + select).select("img").attr("class", "gameInactive");
		}
		game_HasFocus = null;
		splitMenu(split_HasFocus);
		refreshSplitsList(currSort);
		return;
	}
	d3.select("#" + select).select("img").attr("class", "gameActive");
	d3.select("#" + game_HasFocus).select("img").attr("class", "gameInactive");
	game_HasFocus = select;
	refreshSplitsList(currSort);
	splitMenu(split_lastFocus[select]);
	saveProgramState();
}

function checkVersion() {
	request({
		url: "https://api.github.com/repos/noahkra/splitsAnalyser/releases",
		headers: {
			"User-Agent": "SplitsAnalyser"
		}
	}, function(error, response, body) {
		if (error) { throw error; }
		console.log(response);
		body = JSON.parse(body);
		if (semVer.gt(semVer.valid(body[0].tag_name), version)) {
			if (window.confirm("A new version of SplitsAnalyser (" + body[0].tag_name + ") is available on GitHub.\n\nPress OK to go to the download page or Cancel to continue to the program.")) {
				shell.openExternal(body[0].html_url);
			}
		}
	});
}

function loadSplits() {
	if (!fs.existsSync(saveLocation)) { // Create directory if it doesn't exist yet
		fs.mkdir(saveLocation, (err) => { console.log(err); });
	}

	if (!fs.existsSync(saveLocation + "splits.json")) { // create splits json if it doesn't exist yet
		fs.writeFile(saveLocation + "splits.json", "{}", (err) => { console.log(err); });
	} else {
 		fs.readFile(saveLocation + "splits.json", (err, data) => { // read in splits json
 			if (err) { throw err; }
 			splits = JSON.parse(data);
			
			for (let i in Object.keys(splits)) {
				gui.addGame(Object.keys(splits)[i], splits[Object.keys(splits)[i]].metadata.cover, options);
			}

			loadProgramState();
			srcRefresh();
			checkModifiedSplits();
 		});
	}

}


// Massive function that imports the splits files into the program after being selected by the pop up prompt
function importSplitFile(file) {
	// overlay div to prevent css cursor
	d3.select("body").append("div").attr("id", "loaddiv");
	document.body.style.cursor = "progress";

	fs.readFile(file, (err, data) => {
		if (err) { throw err; } // Error handling
		xml2js(data, {explicitArray: false},(err, result) => { // convert the xml to a JS object we can use
			let gameName = result.Run.GameName.trim().toLowerCase().replace(/( )/g, "-"); // Variable for the game name which is used throughout this function
			request({
					url: `https://www.speedrun.com/api/v1/games?name=${gameName.replace(/(-)/g, "%20")}`
				}, function(error, response, body) {
					try {
						console.log(result);
						if (body.startsWith("<")) {
							throw "Can't reach speedrun.com API. Please try again later.";
						}

						body = JSON.parse(body);
						if (!(gameName in splits)) {
							splits[gameName] = {
								"metadata" : {
									"cover": `https://www.speedrun.com/themes/${body.data[0].abbreviation}/cover-256.png`
								},
								"runs": {}
							};

							
						gui.addGame(gameName, splits[gameName].metadata.cover, options);
							
						}

						let curRun = 0;
						while (splits[gameName].runs[curRun]) {
							curRun++;
						}

						splits[gameName].runs[curRun] = {
							"new"               : true,
							"name"              : path.basename(file).replace(new RegExp(gameName + "|" + result.Run.CategoryName + "|[^0-9a-z ]|lss", "gi"), "").trim(),
							"file"              : path.basename(file),
							"path"              : file,
							"modified"          : new Date().getTime(),
							"category"          : result.Run.CategoryName,
							"succesfulAttempts" : {},
							"segments"          : {},
							"pb"                : [],
							"pbSegments"        : {},
							"stddevSegments"    : {},
							"sob"               : {}
						};

						if (splits[gameName].runs[curRun].name.length < 3) {
							splits[gameName].runs[curRun].name = "Unnamed Split " + curRun;
						}

						let attempts = convertToSingleArray(result.Run.AttemptHistory.Attempt);
					
						for (let i in attempts) {
							if (attempts[i].RealTime) {
								splits[gameName].runs[curRun].succesfulAttempts[attempts[i].$.id] = attempts[i].RealTime;
							}
						}

						if (Object.keys(splits[gameName].runs[curRun].succesfulAttempts).length === 0) { // if there are no attempts throw empty split error
							deleteSplit(curRun, gameName);
							throw "Splits file is empty";
						}

						splits[gameName].runs[curRun].pb = [Math.min(...attempts.map(
							d => {
								if (d.RealTime) {
									return analyser.time2ms(d.RealTime);
								}
							}).filter(d => d)),
							attempts[attempts.findIndex((d) => d.RealTime !== undefined && analyser.time2ms(d.RealTime) === Math.min(...attempts.map(d => {
								if (d.RealTime) {
									return analyser.time2ms(d.RealTime);
								}
							}).filter(d => d)))].$.id];

						let segments = result.Run.Segments.Segment;

						for (let i in segments) {

							let isSubsplit = false;
							if (segments[i].Name.startsWith("-") || segments[i].Name.startsWith("{")) { isSubsplit = true; }

							let segmentName = i + "_" + segments[i].Name; // Set up the segment name

							let segmentTimes = convertToSingleArray(segments[i].SegmentHistory.Time);

							let splitTimes = convertToSingleArray(segments[i].SplitTimes.SplitTime);

							let curTime;

							if (!splitTimes[splitTimes.findIndex((a) => a.$.name === "Personal Best")].RealTime) {
								throw "Split file doesn't contain any segment times";
							}

							// Set up the new nested objects
							if (!parseInt(i)) {
								splits[gameName].runs[curRun].pbSegments.tmp = {};
								splits[gameName].runs[curRun].segments.tmp = {};
								splits[gameName].runs[curRun].stddevSegments.tmp = {};
								curTime = analyser.time2ms(splitTimes[splitTimes.findIndex((a) => a.$.name === "Personal Best")].RealTime);
							} else {
								curTime = analyser.time2ms(splitTimes[splitTimes.findIndex((a) => a.$.name === "Personal Best")].RealTime) - 
									analyser.time2ms(convertToSingleArray(segments[parseInt(i) - 1].SplitTimes.SplitTime)[splitTimes.findIndex((a) => a.$.name === "Personal Best")].RealTime);
							}

							// storing pb seperately
							if (isSubsplit) {
								// subsplits
								if (segments[i].Name.startsWith("-")) {
									splits[gameName].runs[curRun].pbSegments.tmp[segmentName.replace("-", "")] = curTime;
									
								}
								// final subsplit
								if (segments[i].Name.startsWith("{")) {
									let curSubsplit = Object.keys(splits[gameName].runs[curRun].pbSegments).length-1;
									splits[gameName].runs[curRun].pbSegments.tmp[segmentName.substring(0, segmentName.indexOf("{")) + segmentName.substring(segmentName.indexOf("}") + 1)] = curTime;
									splits[gameName].runs[curRun].pbSegments["sub" + (parseInt(curSubsplit) + 1) + "_" + segmentName.substring(segmentName.indexOf("{") + 1, segmentName.indexOf("}"))] = splits[gameName].runs[curRun].pbSegments.tmp;
									splits[gameName].runs[curRun].pbSegments.tmp = {};
								}
							} else {
								splits[gameName].runs[curRun].pbSegments[segmentName] = curTime;
							}

							for (let j in segmentTimes) {
								if (segmentTimes[j].RealTime) {
									let runID = segmentTimes[j].$.id;
									// every run is stored in here, including the pb
									if (isSubsplit) {
										// subsplits
										if (segments[i].Name.startsWith("-")) {
											if (!splits[gameName].runs[curRun].segments.tmp[segmentName.replace("-", "")]) { splits[gameName].runs[curRun].segments.tmp[segmentName.replace("-", "")] = {}; }
											splits[gameName].runs[curRun].segments.tmp[segmentName.replace("-", "")][runID] = analyser.time2ms(segmentTimes[j].RealTime);


										}
										// final subsplit
										if (segments[i].Name.startsWith("{")) {
											let curSubsplit = Object.keys(splits[gameName].runs[curRun].segments).length;
											if (!splits[gameName].runs[curRun].segments.tmp[segmentName.substring(0, segmentName.indexOf("{")) + segmentName.substring(segmentName.indexOf("}") + 1)]) { 
												splits[gameName].runs[curRun].segments.tmp[segmentName.substring(0, segmentName.indexOf("{")) + segmentName.substring(segmentName.indexOf("}") + 1)] = {}; 
											}
											splits[gameName].runs[curRun].segments.tmp[segmentName.substring(0, segmentName.indexOf("{")) + segmentName.substring(segmentName.indexOf("}") + 1)][runID] = analyser.time2ms(segmentTimes[j].RealTime);

											if (parseInt(j) === segmentTimes.length - 1) {
												splits[gameName].runs[curRun].segments["sub" + curSubsplit + "_" + segmentName.substring(segmentName.indexOf("{") + 1, segmentName.indexOf("}"))] = splits[gameName].runs[curRun].segments.tmp;
												splits[gameName].runs[curRun].segments.tmp = {};
											}
										}
									} else {
										if (!splits[gameName].runs[curRun].segments[segmentName]) { splits[gameName].runs[curRun].segments[segmentName] = {}; }
										splits[gameName].runs[curRun].segments[segmentName][runID] = analyser.time2ms(segmentTimes[j].RealTime);
									}
								}
							}
							

							// Standard deviation
							if (isSubsplit) {
								// subsplits
								if (segments[i].Name.startsWith("-")) {
									splits[gameName].runs[curRun].stddevSegments.tmp[segmentName.replace("-", "")] = d3.deviation(segmentTimes.map((x) => { if (x.RealTime) { return analyser.time2ms(x.RealTime); }} ));
								}
								// final subsplit
								if (segments[i].Name.startsWith("{")) {
									let curSubsplit = Object.keys(splits[gameName].runs[curRun].stddevSegments).length-1;
									splits[gameName].runs[curRun].stddevSegments.tmp[segmentName.substring(0, segmentName.indexOf("{")) + segmentName.substring(segmentName.indexOf("}") + 1)] = d3.deviation(segmentTimes.map((x) => { if (x.RealTime) { return analyser.time2ms(x.RealTime); }} ));
									splits[gameName].runs[curRun].stddevSegments["sub" + (parseInt(curSubsplit) + 1) + "_" + segmentName.substring(segmentName.indexOf("{") + 1, segmentName.indexOf("}"))] = splits[gameName].runs[curRun].stddevSegments.tmp;
									splits[gameName].runs[curRun].stddevSegments.tmp = {};
								}
							} else {
								splits[gameName].runs[curRun].stddevSegments[segmentName] = d3.deviation(segmentTimes.map((x) => { if (x.RealTime) { return analyser.time2ms(x.RealTime); }} ));
							}
						}

						let curbests = {};

						let sobover = {};

						let idmap = {};

						// warning proceed with caution. Do not try to comprehend the kraken of code underneath this comment. it took me several hours to figure out

						for (let i in segments) {
							curbests[i + "_" + segments[i].Name] = Number.MAX_SAFE_INTEGER;
							let segmentTimes = convertToSingleArray(segments[i].SegmentHistory.Time);
							for (let j in segmentTimes) {
								if (!idmap[segmentTimes[j].$.id]) { idmap[segmentTimes[j].$.id] = []; }
								if (!idmap[segmentTimes[j].$.id].includes(i) && parseInt(segmentTimes[j].$.id) >= 0) {									
									idmap[segmentTimes[j].$.id].push(i);
								}
							}
						}

						let idkeys = Object.keys(idmap);

						let segCount = Object.keys(segments).length;

						for (let i = 0; i < idkeys.length; i++) { // i is run
							let curRunID = idkeys[i];
							for (let j = 0; j < idmap[curRunID].length; j++) { // j is seg
								let curSegID = idmap[curRunID][j];
								let segmentTimes = convertToSingleArray(segments[curSegID].SegmentHistory.Time);
								if (!segmentTimes[segmentTimes.findIndex((a) => a.$.id === curRunID )].RealTime) { continue; }
								if (analyser.time2ms(segmentTimes[segmentTimes.findIndex((a) => a.$.id === curRunID )].RealTime) < curbests[idmap[curRunID][j] + "_" + segments[curSegID].Name]) {
									curbests[idmap[curRunID][j] + "_" + segments[curSegID].Name] = analyser.time2ms(segmentTimes[segmentTimes.findIndex((a) => a.$.id === curRunID )].RealTime);
								}
							}

							if (Object.values(curbests).reduce((a, b) => a + b) >= Number.MAX_SAFE_INTEGER) { continue; }
							sobover[curRunID] = Object.values(curbests).reduce((a, b) => a + b);
						}

						// okay that was it.


						splits[gameName].runs[curRun].sob = sobover;
		
						delete splits[gameName].runs[curRun].pbSegments.tmp;
						delete splits[gameName].runs[curRun].segments.tmp;
						delete splits[gameName].runs[curRun].stddevSegments.tmp;
						if (game_HasFocus !== gameName) {
							gameMenu(gameName);
						}
						srcRefresh();
						refreshSplitsList(currSort);
						splitMenu(gameName + "_" + curRun);
						saveSplits();
					} catch (e) {
						window.alert("Error: " + e + ".\n\nIf this is an unexpected error, please submit an issue on github with this error, if none are already present.");
						throw e;
					} finally { // remove loading div
						d3.select("#loaddiv").remove();
						document.body.style = "";
					}
				}
			);
		});
	});
}


function analysis(splitselect) {
	if (splitselect === null) {
		d3.select("#analysisArea").html("");
		return;
	}

	d3.select("#analysisArea").html("");
	var split = splits[splitselect.substring(0, splitselect.indexOf("_"))].runs[splitselect.substring(splitselect.indexOf("_") + 1)];

	// put the wr run into a variable

		let srcTable = d3.select("#analysisArea").append("div").attr("id", "tableDiv").append("table").attr("id", "srcTable");
		let tr = srcTable.append("tr");
		tr.append("th").text("Current WR").attr("class", "tableNumerical");
		tr.append("th");
		tr = srcTable.append("tr").attr("class", "splitstablerow");
		let wr;
	if (src[game_HasFocus].records) {
		if (src[game_HasFocus].levels.data.find(a => getLevDistance(a.name, split.name) >= 0.3)) {
			wr = src[game_HasFocus].records.data.filter(
					a => a.category === src[game_HasFocus].categories.data.filter(
						a => a.type === "per-level").find(a => getLevDistance(a.name, split.category) >= 0.9).id)
				.find(
					a => a.level === src[game_HasFocus].levels.data.find(
						a => getLevDistance(a.name, split.name) >= 0.3).id)
				.runs[0].run;
		} else {
			wr = src[game_HasFocus].records.data.filter(
					a => a.category === src[game_HasFocus].categories.data.filter(
						a => a.type === "per-game").find(a => getLevDistance(a.name, split.category) >= 0.9).id)
			[0].runs[0].run;
		}

		tr.append("td").text(
			analyser.timeFormat(wr.times.primary_t * 1000)
		).attr("class", "tableNumerical");

		if (split.pb[0] <= wr.times.primary_t * 1000) {
			tr.append("td").style("font-style", "italic").text("You have WR! Go submit it on speedrun.com if you haven't already!");
		} else {
			if (Object.values(split.sob)[Object.values(split.sob).length - 1] < wr.times.primary_t * 1000) {
				tr.append("td").style("font-style", "italic").text("This WR is slower than your SOB and within your reach! Keep practicing!");
			} else {
				tr.append("td").style("font-style", "italic").text("Your SOB is slower than the WR, keep practicing to improve it!");
			}
		}
	} else {
		tr.append("td").text("Getting WR...").attr("class", "tableNumerical");
		tr.append("td").attr("class", "tableNumerical").attr("width", "100%");
	}
	
	let splitTable = d3.select("#tableDiv").append("table").attr("id", "splitTable");
	tr = splitTable.append("tr").attr("class", "tableheaders");
	tr.append("th").text("Total Attempts").attr("class", "tableNumerical");
	tr.append("th").text("Current PB").attr("class", "tableNumerical").attr("title", "Current Personal Best");
	tr.append("th").text("Current SOB").attr("class", "tableNumerical").attr("title", "Current Sum of Best Segments");
	tr.append("th").text("Total Possible Timesave").attr("class", "tableNumerical");
	tr.append("th").text("Mean Standard Deviation").attr("class", "tableNumerical");

	tr = splitTable.append("tr").attr("class", "splitstablerow");
	tr.append("td").text(d3.max(Object.keys(split.sob), (d) => parseInt(d))).attr("class", "tableNumerical");
	tr.append("td").text(analyser.timeFormat(split.pb[0])).attr("class", "tableNumerical");
	tr.append("td").text(analyser.timeFormat(Object.values(split.sob)[Object.values(split.sob).length - 1])).attr("class", "tableNumerical");
	tr.append("td").text(analyser.timeFormat(split.pb[0] - Object.values(split.sob)[Object.values(split.sob).length - 1])).attr("class", "tableNumerical");

	tr.append("td").text(() => {
		if (typeof Object.entries(split.stddevSegments)[0][1] === "object") {
			return analyser.timeFormat(d3.mean(Object.values(Object.assign(...[].concat(...Object.entries(split.stddevSegments)).filter((d) => typeof d === "object")))));	
		}
		return analyser.timeFormat(d3.mean(Object.values(split.stddevSegments)));
	}).attr("class", "tableNumerical");

	let segmentsTable = d3.select("#tableDiv").append("table").attr("id", "segmentsTable");
	tr = segmentsTable.append("thead").append("tr").attr("class", "tableheaders");
	tr.append("th").text("Segment");
	tr.append("th").text("Personal Best").attr("class", "tableNumerical");
	tr.append("th").text("Best Segment").attr("class", "tableNumerical");
	tr.append("th").text("Possible Timesave").attr("class", "tableNumerical");
	tr.append("th").text("Standard Deviation").attr("class", "tableNumerical");

	let splitKeys = Object.keys(split.segments);

	segmentsTable = d3.select("#segmentsTable").append("tbody");

	for (let i in splitKeys) {
		if (splitKeys[i].startsWith("sub")) { // checking if it's a subsplit
			tr = segmentsTable.append("tr").attr("class", "tablesubsplitheader");
			tr.append("th").attr("class", "tableSubsplit th" + i)
					.text(splitKeys[i].substring(splitKeys[i].indexOf("_") + 1)).attr("colspan", "5")
					.attr("onclick", "gui.collapseSeg('" + i + "')")
					.attr("title", "Collapse segment")
				.append("svg")
					.attr("preserveAspectRatio", "none")
					.attr("viewBox", "0 0 24 24")
					.style("transform", "scale(1.2)")
					.attr("class", "dropDown")
				.append("use")
					.attr("href", "#icon_dropUp");
			let subSplitKeys = Object.keys(split.segments[splitKeys[i]]);
			for (let j in subSplitKeys) {
				tr = segmentsTable.append("tr").attr("class", "tableRow tr" + i);
				if (Object.values(split.pbSegments)[i][subSplitKeys[j]] - d3.min(Object.entries(split.segments[splitKeys[i]][subSplitKeys[j]]).map( d => { return d[1]; })) === 0) {
					tr.attr("class", "tableRow tr" + i + " gold");
				}
				tr.append("td").text(subSplitKeys[j].substring(subSplitKeys[j].indexOf("_") + 1));
				tr.append("td").text(analyser.timeFormat(Object.values(split.pbSegments)[i][subSplitKeys[j]])).attr("class", "tableNumerical");
				tr.append("td").text(analyser.timeFormat(d3.min(Object.entries(split.segments[splitKeys[i]][subSplitKeys[j]]).map( d => { return d[1]; })))).attr("class", "tableNumerical");
				tr.append("td").text(analyser.timeFormat(Object.values(split.pbSegments)[i][subSplitKeys[j]] - d3.min(Object.entries(split.segments[splitKeys[i]][subSplitKeys[j]]).map( d => { return d[1]; })))).attr("class", "tableNumerical");
				tr.append("td").text(analyser.timeFormat(Object.values(split.stddevSegments)[i][subSplitKeys[j]])).attr("class", "tableNumerical");
			}

		} else {
			tr = segmentsTable.append("tr").attr("class", "tableRow");
			if (Object.values(split.pbSegments)[i] - d3.min(Object.entries(split.segments[splitKeys[i]]).map( d => { return d[1]; })) === 0) {
				tr.attr("class", "tableRow gold");
			}
			tr.append("td").text(splitKeys[i].substring(splitKeys[i].indexOf("_") + 1));
			tr.append("td").text(analyser.timeFormat(Object.values(split.pbSegments)[i])).attr("class", "tableNumerical");
			tr.append("td").text(analyser.timeFormat(d3.min(Object.entries(split.segments[splitKeys[i]]).map( d => { return d[1]; })))).attr("class", "tableNumerical");
			tr.append("td").text(analyser.timeFormat(Object.values(split.pbSegments)[i] - d3.min(Object.entries(split.segments[splitKeys[i]]).map( d => { return d[1]; })))).attr("class", "tableNumerical");
			tr.append("td").text(analyser.timeFormat(Object.values(split.stddevSegments)[i])).attr("class", "tableNumerical");
		}
	}

	buildGraph = function(pbonly) {
		d3.select("#splitsGraphDiv").remove();
		let margin = {top: 30, right: 30, bottom: 60, left: 90},
		width      = 800 - margin.left - margin.right,
		height     = 400 - margin.top - margin.bottom;


		let dat  = [];
		let prev = 99999999999;

		//pb only
		for (let i in split.succesfulAttempts) {
			if (analyser.time2ms(split.succesfulAttempts[i]) < prev || !pbonly) {
				dat.push({"x": i, "y": analyser.time2ms(split.succesfulAttempts[i])});
				prev = analyser.time2ms(split.succesfulAttempts[i]);
			}
		}

		let dat2 = [];
		let tot = 0;
		for (let i in dat) {
			tot += parseInt(dat[i].y);
			dat2.push({"x": dat[i].x, "y": parseInt((tot/(parseInt(i)+1)).toFixed())});
		}

		let dat3 = [];
		for (let i in split.sob) {
			if (parseInt(i) < 0 || parseInt(split.sob[i]) < 0) { continue; }
			dat3.push({"x": i, "y": split.sob[i]});
		}

		var svgdiv = d3.select("#analysisArea").append("div").attr("id", "splitsGraphDiv");

		var svg = svgdiv.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.attr("id", "splitsGraph")
			.append("g")
			.attr("transform",
			      "translate(" + margin.left + "," + margin.top + ")");

		var x = d3.scaleLinear()
			.domain([0, d3.max(dat.concat(dat2, dat3), d => { return parseInt(d.x); })])
			.range([0, width]).nice();
		svg.append("g")
			.attr("transform", "translate(0, " + height + ")")
			.call(d3.axisBottom(x));
		var y = d3.scaleLinear()
			.domain([new Date(d3.min(dat.concat(dat2, dat3), d => { return d.y; })), new Date(d3.max(dat.concat(dat2, dat3), d => { return d.y; }))])
			.range([height, 0]).nice();
		svg.append("g")
			.call(d3.axisLeft(y)
			.tickFormat(d => { return analyser.timeFormat(d); })
			);

		svg.append("path")
			.datum(dat)
			.attr("fill", "none")
			.attr("stroke", "steelblue")
			.attr("class", "runs")
			.attr("stroke-width", 1.5)
			.attr("d", d3.line()
				.curve(d3.curveMonotoneX)
				.x(function(d) { return x(d.x); })
				.y(function(d) { return y(d.y); })
			);

		svg.append("path")
			.datum(dat2)
			.attr("fill", "none")
			.attr("stroke", "green")
			.attr("class", "averageRuns")
			.attr("stroke-width", 1.5)
			.attr("d", d3.line()
				.curve(d3.curveMonotoneX)
				.x(function(d) { return x(d.x); })
				.y(function(d) { return y(d.y); })
			);

		svg.append("path")
			.datum(dat3)
			.attr("fill", "none")
			.attr("stroke", "orange")
			.attr("class", "SOB")
			.attr("stroke-width", 1.5)
			.attr("d", d3.line()
				.curve(d3.curveStepAfter)
				.x(function(d) { return x(d.x); })
				.y(function(d) { return y(d.y); })
			);

		// Chart Title
		svg.append("text")
			.attr("x", (width / 2))
			.attr("y", 10 - (margin.top / 2))
			.attr("text-anchor", "middle")
			.style("font-size", "16px")
			.style("fill", "white")
			.text("Duration over Attempts");

		// Y axis title
		svg.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 10 - margin.left)
			.attr("x", 0 - (height / 2))
			.attr("dy", "1em")
			.style("text-anchor", "middle")
			.style("fill", "white")
			.text("Duration");

		// X axis title
		svg.append("text")
			.attr("transform", 
				"translate(" + (width / 2) + ", " + (height + margin.top + 10) + ")")
			.style("text-anchor", "middle")
			.style("fill", "white")
			.text("Attempts");

		// LEGEND
		let ordinal = d3.scaleOrdinal()
			.domain(["Runs", "Average of Runs", "SOB"])
			.range(["steelblue", "green", "orange"]);

		svg.append("g")
			.attr("class", "legend")
			.attr("transform", "translate(" + (width - 120) + ", 20)");

		let legendOrdinal = d3.legendColor()
			.shape("circle")
			.shapePadding(10)
			.labelAlign("end")
			.shapeRadius(5)
			.cellFilter(function(d){ return d.label !== "e"; })
			.scale(ordinal);
			// .on("cellclick", (d) => {
			// 	console.log(d)
			// 	d3.select("." + d.replace(" ", "")).remove();
			// 	// d3.selectAll(".cell").selectAll(".label").filter((d) => { return d3.select(this).text() === d}).style("fill", "grey").node().parentNode.select("circle").style("fill", "grey");
			// });

		svg.select(".legend")
			.call(legendOrdinal);


		svgdiv.append("div").attr("id", "splitsGraphSet")
			.append("input").attr("type", "button").attr("onclick", `buildGraph(${!pbonly})`).attr("value", `Show ${pbonly ? "All" : "PBs Only"}`);
	};

	buildGraph(false);
}

function saveSplits() {
	fs.truncate(saveLocation + "splits.json", 0, () => {
		fs.writeFile(saveLocation + "splits.json", JSON.stringify(splits), (err) => { if (err) { throw err; }});
	});
}

function loadProgramState() {
	if (!fs.existsSync(saveLocation)) { // Create directory if it doesn't exist yet
		fs.mkdir(saveLocation, (err) => { console.log(err); });
	}

	if (!fs.existsSync(saveLocation + "programstate.json")) { // create splits json if it doesn't exist yet
		let data = {
			game_HasFocus: game_HasFocus,
			split_HasFocus: split_HasFocus,
			split_lastFocus: split_lastFocus,
			currSort: currSort,
			winBounds: winBounds
		};

		fs.writeFile(saveLocation + "programstate.json", JSON.stringify(data), (err) => { console.log(err); });
	} else {
 		fs.readFile(saveLocation + "programstate.json", (err, data) => { // read in splits json
 			if (err) { throw err; }
 			data = JSON.parse(data);

			gameMenu(data.game_HasFocus);
			splitMenu(data.split_HasFocus);
			split_lastFocus = data.split_lastFocus;
			currSort = data.currSort;
 			winBounds = data.winBounds;
 		});
	}
}

function saveProgramState() {
	fs.truncate(saveLocation + "programstate.json", 0, () => {
		let data = {
			game_HasFocus: game_HasFocus,
			split_HasFocus: split_HasFocus,
			split_lastFocus: split_lastFocus,
			currSort: currSort,
			winBounds: winBounds
		};

		fs.writeFile(saveLocation + "programstate.json", JSON.stringify(data), (err) => { if (err) { throw err; }});
	});
}

function checkModifiedSplits() {
	for (let i in splits) {
		for (let j in splits[i].runs) {
			fs.stat(splits[i].runs[j].path, function(err, stats) { 
				if (stats.mtimeMs > splits[i].runs[j].modified) {
					reloadSplit(j, i);
				}
			});
		}
	}
}

function reloadSplit(split, game) {
	if (split === "all") {
		for (let i in splits) {
			for (let j in splits[i].runs) {
				importSplitFile(splits[i].runs[j].path);
				deleteSplit(j, game, true);
			}
		}
		return;
	}

	importSplitFile(splits[game].runs[split].path);
	deleteSplit(split, game, true);
}

function renameSplit(split, game) {
	let id = "#" + game + "_" + split;
	d3.select(id).select(".splitName").remove();
	let input = d3.select(id).insert("input", "svg").attr("class", "splitNameChanging").attr("value", splits[game].runs[split].name).node();
	input.focus();
	input.select();
	let func = function(event) {
		if (event.type === "blur" || event.key === "Enter") {
			event.preventDefault();
			if (input.value.replace(/ /g, "").length < 3) {
				window.alert("Please use a name with a minimum of 3 non-null characters.");
					input.focus();
					input.select();
				return;
			}
			input.removeEventListener("keyup", func);
			input.removeEventListener("blur", func);
			splits[game].runs[split].name = input.value;
			d3.select(".splitNameChanging").remove();
			d3.select(id).insert("span", "svg").attr("class", "splitName").text(splits[game].runs[split].name)
				.attr("onclick", "renameSplit(" + split + ", '" + game + "')");
			saveSplits();
		}

		if (event.key === "Escape") {
			event.preventDefault();
			input.removeEventListener("keyup", func);
			input.removeEventListener("blur", func);
			d3.select(".splitNameChanging").remove();
			d3.select(id).insert("span", "svg").attr("class", "splitName").text(splits[game].runs[split].name)
				.attr("onclick", "renameSplit(" + split + ", '" + game + "')");
		}
	};

	input.addEventListener("keyup", func);
	input.addEventListener("blur", func);
}

function srcRefresh() {
	let gamesAmt = Object.keys(splits).length; // amount of games
	if (!gamesAmt) { return; }
	// levels: https://www.speedrun.com/api/v1/games/[game]/levels
	// categories: https://www.speedrun.com/api/v1/games/[game]/categories
	// leaderboards: https://www.speedrun.com/api/v1/leaderboards/[game]/[category] OR https://www.speedrun.com/api/v1/leaderboards/[game]/[level]/[category]
	for (let i = 0; i < gamesAmt; i++) {
		let game = Object.keys(splits)[i];
		let links;
		src[game] = {};

		request({ url: `https://www.speedrun.com/api/v1/games?name=${game.replace(/(-)/g, "%20")}`}, function(err, response, body) {
			links = JSON.parse(body).data[0].links;
			request({ url: `${links.find(a => a.rel === "levels").uri}?max=200`}, function(err, response, body) {
				src[game].levels = JSON.parse(body);
				request({ url: `${links.find(a => a.rel === "categories").uri}?max=200`}, function(err, response, body) {
					src[game].categories = JSON.parse(body);
					request({ url: `${links.find(a => a.rel === "records").uri}?top=1&max=200`}, function(err, response, body) {
						src[game].records = JSON.parse(body);
						if (split_HasFocus) {
							analysis(split_HasFocus);
						}
					});
				});
			});
		});
	}

}

function getLevDistance(string, target) { // Function for getting the Levenshtein distance between two strings
	if (string.length === 0 || target.length === 0) {
		return;
	}

	string = string.toLowerCase().replace(/[^A-Za-z]/g, " ");
	target = target.toLowerCase().replace(/[^A-Za-z]/g, " ");

	let long = string;
	let short = target;

	if (string.length < target.length) {
		long = target;
		short = string;
	}

	let subCost = [];

	for (let i = 0; i <= long.length; i++) {
		let lastValue = i;
		for (let j = 0; j <= short.length; j++) {
			if (i === 0) {
				subCost[j] = j;
			} else {
				if (j > 0) {
					let newValue = subCost[j - 1];
					if (long.charAt(i - 1) !== short.charAt(j - 1)) {
						newValue = Math.min(Math.min(newValue, lastValue), subCost[j]) + 1;
					}

					subCost[j - 1] = lastValue;
					lastValue = newValue;
				}
			}
		}
		if (i > 0) {
			subCost[short.length] = lastValue;
		}
	}

	return (long.length - subCost[short.length]) / parseFloat(long.length);
}

// Execute first functions after loading up program.
checkVersion();
loadSplits();

