
function collapseSeg(sub) {
	d3.selectAll(".tr" + sub).style("display", "none");
	d3.select(".th" + sub)
		.select("svg").select("use")
			.attr("href", "#icon_dropDown");
	d3.select(".th" + sub)
		.attr("onclick", "gui.decollapseSeg('" + sub + "')")
		.attr("title", "Decollapse segment");
}

function decollapseSeg(sub) {
	d3.selectAll(".tr" + sub).style("display", null);
	d3.select(".th" + sub)
		.select("svg").select("use")
			.attr("href", "#icon_dropUp");
	d3.select(".th" + sub)
		.attr("onclick", "gui.collapseSeg('" + sub + "')")
		.attr("title", "Collapse segment");
}

function openSettings() {
	d3.select("#settingsContainer")
		.style("display", "block");

	setTimeout(() => {
		d3.select("#settingsContainer")
			.style("opacity", 1);
	}, 1);
}

function closeSettings() {
	d3.select("#settingsContainer")
		.style("opacity", 0);

	setTimeout(() => {
		d3.select("#settingsContainer")
			.style("display", "none");
	}, 150);
}

function addGame(gameName, cover, options) {
	let gameselector = d3.select("#gamesSidebar").insert("div", "div").style("position", "relative").attr("id", gameName);
	gameselector.append("img").attr("src", cover).attr("class", "gameInactive").attr("onclick", `gameMenu('${gameName}')`);
	if (options.gameLabel) {
		gameselector.append("div").attr("class", "gameLabel").text(gameName.replace(/(-)/g, " "));
	}
}
function removeGame(gameName) {
	d3.select("#" + gameName).remove();
}

function setTheme(theme) {
	d3.select()
}


module.exports = { collapseSeg, decollapseSeg, openSettings, closeSettings, addGame, removeGame };