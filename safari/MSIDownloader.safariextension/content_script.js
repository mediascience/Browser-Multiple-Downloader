var anchors,observer,plugin,folder,downloads,downloadIndex,downloading=false;

function init() {
	//create an observer instance to listen for anchor changes
	observer=new MutationObserver(function(mutations) {
		var doCheck=false;
		mutations.forEach(function(mutation) {
			if(mutation.addedNodes || mutation.removedNodes) {
				doCheck=true;
			}
		});
		//if anchors changed in the page, tell the background
		if(doCheck) {
			checkForAnchors();
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

init();
