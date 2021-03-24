# SplitsAnalyser

## This branch will be a complete rework of SplitsAnalyser and it's functionalities. In the time since I've started work on it I've learned a lot of things about development and it would be way easier to just start from scratch than to try fix the current version and keep it compatible with previous ones. This does mean that the program won't retain any user info, but I don't think that's that much of a problem.

![release_shield](https://img.shields.io/github/v/release/noahkra/splitsanalyser?include_prereleases&color=blue) ![totaldownloads_shield](https://img.shields.io/github/downloads/noahkra/splitsanalyser/total?label=total%20downloads) ![latestdownloads_shield](https://img.shields.io/github/downloads-pre/noahkra/splitsanalyser/latest/total) 

![bug shield](https://img.shields.io/github/issues-raw/noahkra/splitsanalyser/bug) ![enhancements shield](https://img.shields.io/github/issues-raw/noahkra/splitsanalyser/enhancement) ![closedissues shield](https://img.shields.io/github/issues-closed-raw/noahkra/splitsanalyser?color=green)

A program for analysing Livesplit splits files and showing statistics, graphs and much more!

## How the program is built up:
Launching the program launches *app.js*. This will get electron up and running and will launch the splash screen *splash.html* while the main file is being loaded.
The main file is *index.html*, which in itself launches *index.js*. This is where most of the code is stored.
There's two main dependencies outside of the node modules, which are *d3.js* and *d3-legend.js*. Both are stored locally to speed up the program and having it as non-reliant to an internet connection as possible.
Other node modules needed for development are specified in *package.json*.

## Contributing guidelines:
Please make sure to check out CONTRIBUTING.md before contributing any code to the repo!
