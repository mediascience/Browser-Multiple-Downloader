# MultipleFileDownloaderJS

MultipleFileDownloaderJS is a library that interfaces with our multiple-file download extensions. It provides the following API:

1. Attach to downloader extension

	var downloader;
	mfd.attach(function (result) {
	    if (result.status === “OK”) {
	      // attached to extension successfully
	      var downloader = result.downloader;
	    } else if (result.status === “AVAILABLE”) {
	      // extension not installed, but available for download
	      showAddonLocation(result.addonUrl);
	    } else if (result.status === “UNAVAILABLE”) {
	      // extension not installed and not available for download
	      noDownloader();
	    }
	});

2. Initiate download
	
	// pass in a collection of downloadable anchors and an optional path (path paramter only works for Firefox and Chrome, and it is relative to the default Downloads folder)
	downloader.initiate(anchorElements, [path]);

3. Select download folder (only for Safari)
	
	// calling selectFolder will open up a file dialog in Safari, with the selected path being passed back to the callback
	downloader.selectFolder(function(selectedFolderPath){
		showDownloadFolderPath(selectedFolderPath);
	});

4. Detect Downloadable Content

	downloader.watch(function (anchorElements) {
	    if (anchorElements.length > 1) {
	      showDownloaderButton();
	    } else {
	      hideDownloaderButton();
	    }
	});


## Community
Find features, implementation details, and miscellaneous discussion on the
[wiki](https://github.com/mediascience/HTML5-Multiple-Download/wiki).

Report bugs, request features, and request pulls in
[issues](https://github.com/mediascience/HTML5-Multiple-Download/issues).


