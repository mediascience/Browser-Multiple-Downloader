var anchors,observer;

function init() {
	//page just loaded so check for download anchors, and notify background page
	checkForAnchors();
	
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
	observer.observe(document.body,{"childList":true,"attributes":true,"characterData":false,"subtree":true});

	//listen for requests from the popup and the background
	chrome.runtime.onMessage.addListener(function(request,sender,sendResponse) {
		console.log("got request:"+JSON.stringify(request));
		
		if(request.getFiles) {
			
			//popup is requesting anchors so refresh list of anchors in page
			//send the file download data to the popup
			sendResponse({"data":updateData()});
		
		} else if(request.observeDownloads) {

			switch(request.observeDownloads) {
				
				case "start":
					//background page is saying that this is the active page
					//so check the anchors immediately, and start observing changes for this page
					checkForAnchors();
					observer.observe(document.body,{"childList":true,"attributes":true,"characterData":false,"subtree":true});
					break;

				case "stop":
					//background page is saying that another page is the active page
					//so stop observing changes for this page
					observer.disconnect;
			}
		}
	});
}

function checkForAnchors() {
	//get all anchors that have an href and a download tag
	anchors=document.querySelectorAll("a[href][download]");
	
	//tell background page to show or hide the page action icon
	//in a dynamic page, downloads may have disappeared or appeared 
	chrome.runtime.sendMessage({"showPageAction":anchors.length>0});
}

function updateData() {
	checkForAnchors();
	
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
