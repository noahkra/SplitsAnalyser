const electron = require("electron");
const { app, BrowserWindow, ipcMain } = electron;

let win, splash;

app.commandLine.appendSwitch("high-dpi-support", "true");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

app.on("ready", () => {
	const screen = electron.screen;
	splash = new BrowserWindow({frame: false, width: 256, height: 256});
	splash.loadFile("splash.html");
	let programstate = require(process.env.APPDATA + "\\splitsAnalyser\\programstate.json");

	let options = {
		backgroundColor: "#1A1A1B",
		icon: "", 
		webPreferences: {
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false
		},
		show: false
	};

	let curDisplay = null;

	if (programstate.winBounds.x) {
		options.x = programstate.winBounds.x;
		options.y = programstate.winBounds.y;
		options.width = programstate.winBounds.width;
		options.height = programstate.winBounds.height;
		curDisplay = screen.getDisplayNearestPoint({x: options.x, y: options.y});
	}


	win = new BrowserWindow(options);
	win.setMenu(null);
	win.loadFile("index.html");

	win.once("ready-to-show", () => {
		splash.destroy();
		if (curDisplay) {
			if (curDisplay.workAreaSize.width < options.width && curDisplay.workAreaSize.height < options.height) {
				win.maximize();
			} else {
				win.show();
			}
		} else {
			win.show();
		}

		if (process.argv[2] === "dev") {
			win.webContents.openDevTools({ mode: "detach" });
		}

		win.on("will-move", (event, newBounds) => {
			win.webContents.send("getBounds", newBounds);

		});
		win.on("will-resize", (event, newBounds) => {
			win.webContents.send("getBounds", newBounds);
		});
		win.on("maximize", () => {
			win.webContents.send("getBounds", win.getBounds());
		});
	});
});

app.on("window-all-closed", () => {
	app.quit();
});