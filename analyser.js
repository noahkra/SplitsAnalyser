// Function for parsing the run times stored in the splits files
function time2ms(time) {
	
	var h  = parseInt(time.substring(0, 2));
	var m  = parseInt(time.substring(3, 5));
	var s  = parseInt(time.substring(6, 8));
	var ms;
	if (time.substring(9, 12)) {
		ms = parseInt(time.substring(9, 12));
	} else {
		ms = 0;
	}

	return ms + s * 1000 + m * 60000 + h * 3600000;
}

// Function for returning a nicely formatted time out of milliseconds (usually paired with time2ms above)
function timeFormat(ms) {
	if (ms > 3600000) {
		return d3.utcFormat("%H:%M:%S")(new Date(ms));
	}
	if (ms > 60000) {
		return d3.utcFormat("%M:%S.%L")(new Date(ms));
	}
	return d3.utcFormat("%S.%L")(new Date(ms));
}


module.exports = { time2ms, timeFormat };