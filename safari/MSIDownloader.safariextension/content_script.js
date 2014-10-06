var anchors,observer,plugin,folder,downloads,downloadIndex,downloading,extensionDetected,isWatching=false,selectedFolder;

function init() {
	//create an observer instance to listen for anchor changes
	observer = new MutationObserver(function(mutations) {
		var doCheck = false;
		mutations.forEach(function(mutation) {
			if (mutation.addedNodes || mutation.removedNodes) {
				doCheck = true;
			}
		});
		//if anchors changed in the page, tell the background
		if (doCheck) {
			checkForAnchors();

			// this will detect if extension is installed on the browser either
			if (!extensionDetected) {
				listenForDownloadExtensionDetect();
			}

			// this will listen for download files when user requests
			var downloadTask = listenForDownloadInitiate();

			// if it is not a download task, listen for changes in anchor tags and respond to use
			if (!downloadTask)
				listenForDownloadWatch();

			listenForFolderChange();
		}
	});
	
	//page just loaded so start observing download anchor changes
	observer.observe(document.body,{"childList":true,"attributes":false,"characterData":false,"subtree":true});

	//listen for requests from the popup and the background
	safari.self.addEventListener("message",receiveMessage,false);
	
	//warn if trying to navigate away while downloading
	window.onbeforeunload=function(e) {
		if(downloading) {
			return "File downloading is in progress and will be cancelled if you leave!";
		}
	};
}

function receiveMessage(event) {
	if(event.name=="getFiles") {
		
		//popup is requesting anchors so refresh list of anchors in page
		//send the file download data to the popup
		var data=updateData();
		safari.self.tab.dispatchMessage("data",data);
		
	} else if(event.name=="checkForAnchors") {
		
		checkForAnchors();
	} else if(event.name=="changeFolder") {
		if(!plugin) {
			createNPAPIPlugin();
		}
		var saveDir;
		try {
			saveDir=plugin.folder(event.message);
			console.log("saveDirectory:"+saveDir);
			if(saveDir===undefined) saveDir=null; //user clicked cancel on dialog
			safari.self.tab.dispatchMessage("saveDirectory",saveDir);
		} catch(e) {
			console.log(e);
			safari.self.tab.dispatchMessage("saveDirectory",null);
		}
		
	} else if(event.name=="defaultFolder") {
		if(!plugin) {
			createNPAPIPlugin();
		}
		var defaultDir;
		try {
			defaultDir=plugin.defaultfolder();
			console.log("defaultDirectory:"+defaultDir);
			safari.self.tab.dispatchMessage("defaultDirectory",defaultDir);
		} catch(e) {
			console.log("error:"+e);
			safari.self.tab.dispatchMessage("defaultDirectory",null);
		}
	} else if(event.name=="processDownloads") {
		if(!plugin) {
			createNPAPIPlugin();
		}
		//set global vars to use with processDownloads function
		folder=event.message.folder;
		downloads=event.message.downloads;
		downloadIndex=0;
		downloading=true;
		processDownloads();
	}
}

function processDownloads() {
	//check if there are any downloads left
	if(downloads.length>0) {
		//download the first item in the list
		var download=downloads[0];
		var result=plugin.download(folder,download.fileName,download.url);
		//if downloading started then remove this one from the list; if busy then just wait 1/10 second and try again
		if(result=="downloading") {
			console.log("downloading - folder:"+folder+"  fileName:"+download.fileName+"  url:"+download.url);
			//notify popup that we are downloading downloadIndex
			safari.self.tab.dispatchMessage("downloading",downloadIndex);
			downloadIndex++;
			//remove the item from the list
			downloads.splice(0,1);
		}
		//wait 1/10 sec before downloading new file, or retrying same file
		setTimeout(processDownloads,100);
	} else {
		//done so tell popup
		console.log("downloads complete!");
		safari.self.tab.dispatchMessage("downloadsComplete",null);
		downloading=false;
		folder = null; // reset folder
	}
}

function createNPAPIPlugin() {
    plugin=document.createElement("embed");
    plugin.setAttribute("hidden",true);
    plugin.setAttribute("type","application/msi-downloader-plugin");
    document.body.appendChild(plugin);
}

function checkForAnchors() {
	//get all anchors that have an href and a download tag
	anchors=document.querySelectorAll("a[href][download]");
	
	//tell background page to show or hide the page action icon
	//in a dynamic page, downloads may have disappeared or appeared
	safari.self.tab.dispatchMessage("anchorCheckResults",anchors.length==0);
}

function updateData() {
	//get all anchors that have an href and a download tag
	anchors=document.querySelectorAll("a[href][download]");
	
	//process the file download data
	var i,anchor;
	var data=[];
	
	for(i=0;i<anchors.length;i++) {
		anchor=anchors[i];
		data.push({
			"href":absolutePath(anchor.getAttribute("href")),
			"download":fileName(anchor.getAttribute("download")),
			"text":anchor.textContent
		});
}
	return data;
}

function absolutePath(href) {
	var a=document.createElement("a");
	a.href=href;
	return a.href;
}

function fileName(path) {
	var i=path.lastIndexOf("/");
	var j=path.lastIndexOf("\\");
	i=(i>j?i:j);
	return (i>-1?path.substr(i+1):path);
}

function listenForDownloadInitiate() {
	var downloaderInitiateTag = document.querySelector("div[id='mfd-downloader-initiate-section']");

	// presence of download tag will indicate a call to downloader initiate
	if (downloaderInitiateTag) {
		var selected = [];

		// preparing array of href and download attributes
		var downloaderSelectTags = document.querySelectorAll("input[mfd-downloader-select-href][mfd-downloader-select-download]");
		// var path = downloaderInitiateTag.getAttribute("mfd-downloader-path");

		if (downloaderSelectTags && downloaderSelectTags.length) {

			var i, selectTag;
			for (i = 0; i < downloaderSelectTags.length; i++) {
				selectTag = downloaderSelectTags[i];
				selected.push({
					"url": absolutePath(selectTag.getAttribute("mfd-downloader-select-href")),
					"fileName": fileName(selectTag.getAttribute("mfd-downloader-select-download"))
				});
			}
			if (!plugin) {
				createNPAPIPlugin();
			}
			
			//set global vars to use with processDownloads function
			folder = selectedFolder || plugin.defaultfolder();
			downloads = selected;
			downloadIndex = 0;
			downloading = true;
			processDownloads();
		}
		downloaderInitiateTag.remove();
		return true;
	}
	return false;
}

function listenForFolderChange(){
	var etag = document.getElementById('mfd-downloader-select-folder-id');
	//console.log ("watching for select folder");
	if (etag) {
		if (!plugin) {
			createNPAPIPlugin();
		}
		if(selectedFolder = plugin.folder()){
			etag.setAttribute('mfd-downloader-path', selectedFolder);
		}else{
			etag.setAttribute('mfd-downloader-path', '');			
		}
		respondToInputTag(etag);
	}
}

function listenForDownloadExtensionDetect() {
	var etag = document.getElementById('mfd-downloader-detect-extension-id');
	//console.log ("extension detected");
	if (etag) {
		respondToInputTag(etag);
		extensionDetected = true;
	}
}

function listenForDownloadWatch() {
	var etag = document.getElementById('mfd-downloader-watch-id');
	//console.log ("watching for download");
	if (etag) {
		if (isWatching)
			respondToInputTag(etag);
		else
			isWatching = true;
	}
}

// this will fire event onchange 
function respondToInputTag(etag) {
	if (etag.dispatchEvent) {
		var evt = document.createEvent("HTMLEvents");
		evt.initEvent("change", false, true);
		etag.dispatchEvent(evt);
	} else {
		etag.fireEvent("onchange");
	}
}

init();