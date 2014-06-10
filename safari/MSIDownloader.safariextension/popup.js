//global vars
var folder,defaultFolder,data,downloaderButton,reopening=false,downloading=false;

//document elements
var chkAll,chkNone,list,table,folderPath,btnDownload,btnChange,btnUseDefault;

//initialize routine
function init() {
	//store toolbar item for this popover
	safari.self.toolbarItem=safari.extension.toolbarItems.filter(function(ti) {
	    return ti.popover==safari.self;
	})[0];
	
	//initialize path folder edit box
	folderPath=document.getElementById("folderPath");
//	folderPath.addEventListener("input",checkPath);

	//initialize button that downloads the selected files
	btnDownload=document.getElementById("btnDownload");
	btnDownload.addEventListener("click",download);

	//initialize button that allows changing/restoring the folder
	btnChange=document.getElementById("btnChange");
	btnChange.addEventListener("click",changeFolder);
	
	//initialize the use default button
	btnUseDefault=document.getElementById("btnUseDefault");
	btnUseDefault.addEventListener("click",useDefaultFolder);
	
	//get previously used folder, if any
	folder=localStorage["folder"];
	defaultFolder=localStorage["defaultFolder"];
	console.log("folder:"+folder);
	console.log("defaultFolder"+defaultFolder);
	if(!folder) {
		useDefaultFolder();
	} else {
		//use previous folder
		folderPath.value=folder;
	}
	
	//initialize select/unselect checkbox
	chkAll=document.getElementById("chkAll");
	chkAll.addEventListener("click",selectUnselect);
	chkNone=document.getElementById("chkNone");
	chkNone.addEventListener("click",selectUnselect);
	
	//setup listener for messages from popup window
	safari.application.addEventListener("message", function(event) {
		if(event.name=="data") {
			//results of the get files request
			data=event.message;
			populateList();
		} else if(event.name=="anchorCheckResults") {
			//results of a request from the validate button event
			if(downloaderButton) {
				downloaderButton.disabled=event.message;
			}
		} else if(event.name=="saveDirectory") {
			//popover was closed by dialog so reopen
			showPopover();
			
			//new save directory returned from content script NPAPI plugin save dialog
			if(event.message) {
				folder=event.message;
				folderPath.value=folder;
				localStorage["folder"]=folder;
			}
		} else if(event.name=="defaultDirectory") {
			//default directory returned from content script NPAPI plugin
			if(event.message) {
				folder=event.message;
				defaultFolder=folder;
				folderPath.value=folder;
				localStorage["folder"]=folder;
				localStorage["defaultFolder"]=defaultFolder;
			}
		} else if(event.name=="downloading") {
			var img,span,j;
			var i=event.message;
			if(i>0) {
				j=i-1;
				img=document.getElementById("image"+j);
				span=document.getElementById("status"+j);
				img.setAttribute("src","downloaded.png");
				span.textContent=" Downloaded";
			}
			img=document.getElementById("image"+i);
			span=document.getElementById("status"+i);
			img.setAttribute("src","loading1.gif");
			span.textContent=" Downloading";
			
		} else if(event.name=="downloadsComplete") {
			downloading=false;
			btnDownload.disabled=false;
			btnChange.disabled=false;
			btnUseDefault.disabled=false;
			safari.self.hide();
		}
	},false);
	
	//update the content when popup event received
	safari.application.addEventListener("popover",function(event) {
		if(event.target.identifier=="DownloadPopover") {
			//ask the content script for the current list of downloadable files
			safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("getFiles",true);
		}		
	},true);
	
	//update the button enabled status when the page is validated
	safari.application.addEventListener("validate",function(event) {
		if(event.target.identifier=="DownloaderButton") {
			//store the button for later, because we have to wait to get word back from the content script, on whether to enable
			downloaderButton=event.target;
			
			try {
				//ask the content script if there are any downloadable links on this page
				safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("checkForAnchors",true);
			} catch(e) {
				downloaderButton.disabled=true;
			}
		}		
	},true);
}

function showPopover() {
    var toolbarItem=safari.extension.toolbarItems.filter(function(tbi) {
        return tbi.identifier=="DownloaderButton" && tbi.browserWindow==safari.application.activeBrowserWindow;
    })[0];

    toolbarItem.showPopover();  
}

function changeFolder() {
	//tell the popover it will need to reopen so don't populate the data again
	reopening=true;
	
	//ask content script to use NPAPI plugin to open directory chooser
	safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("changeFolder",folder);
}

function useDefaultFolder() {
	if(defaultFolder) {
		folder=defaultFolder;
		folderPath.value=folder;
		localStorage["folder"]=folder;
	} else {
		//ask content script to use NPAPI plugin to get the default download folder
		safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("defaultFolder",true);
	}
}

function selectUnselect(event) {
	event.preventDefault();
	var checked=this.id=="chkAll";
	var inputs=table.querySelectorAll("input");
	var i;
	for(i=0;i<inputs.length;i++) {
		inputs[i].checked=checked;
	}
}

//request list from content_script
//function getFiles() {
//	safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("getFiles",true);
//}

function populateList() {
	if(reopening) {
		reopening=false;
		return;
	}
	if(downloading) {
		btnDownload.disabled=true;
		btnChange.disabled=true;
		btnUseDefault.disabled=true;
		return;
	} else {
		btnDownload.disabled=false;
		btnChange.disabled=false;
		btnUseDefault.disabled=false;
	}
	var tr,td,input,txt,a,img,span;
	var i,d;
	
	list=document.getElementById("list");
	//remove table if exists
	if(table) list.removeChild(table);
	
	//create new table
	table=document.createElement("table");
	list.appendChild(table);
	
	//create table row for each file
	for(i=0;i<data.length;i++) {
		d=data[i];
		
		//new row
		tr=document.createElement("tr");
		tr.setAttribute("class","color"+(i&1));
		table.appendChild(tr);
		
		//create checkbox cell
		td=document.createElement("td");
		tr.appendChild(td);
		input=document.createElement("input");
		input.setAttribute("type","checkbox");
		input.setAttribute("checked",true);
		td.appendChild(input);
		
		//create download name cell
		td=document.createElement("td");
		tr.appendChild(td);
		if (!d.text) {
			txt=document.createTextNode(d.download);
			td.className = "download";
			td.appendChild(txt);
		} else {
			txt=document.createTextNode(d.text);
			td.className = "download";
			td.appendChild(txt);
		}
		
		//create href link cell
		/*td=document.createElement("td");
		td.setAttribute("class","linkCellWidth");
		tr.appendChild(td);
		a=document.createElement("a");
		a.setAttribute("href",d.href);
		a.setAttribute("target","_blank");
		a.addEventListener("click",openURL,false);
		td.appendChild(a);
		txt=document.createTextNode(d.href);
		a.appendChild(txt);*/
		
		//create link description cell
		/*td=document.createElement("td");
		//td.setAttribute("class","textCellWidth");
		tr.appendChild(td);
		//txt=document.createTextNode(d.text);
		txt=document.createTextNode(" ");
		td.className = "small_col";
		td.appendChild(txt);*/
		
		//create status cell
		td=document.createElement("td");
		td.setAttribute("class","statusCellWidth");
		tr.appendChild(td);
		img=document.createElement("img");
		img.setAttribute("id","image"+i);
		img.setAttribute("src","thumbup.png");
		td.appendChild(img);
		span=document.createElement("span");
		span.setAttribute("id","status"+i);
		td.appendChild(span);
		txt=document.createTextNode(" Ready");
		span.appendChild(txt);
		
	}
	
	//adjust the height of the popup window to fit the data (because Safari will not adjust it)
	safari.self.height=document.body.offsetHeight+24;
}

function openURL(event) {
	event.preventDefault();
	var newWindow=safari.application.openBrowserWindow();
	newWindow.activeTab.url=this.href;
}

function download() {
	var inputs=table.querySelectorAll("input");
	var i,d,count;
	var folder=localStorage["folder"];

	//add the slash to the end of the path if it exists
	folder=(folder===undefined?"":folder+"/");
	
	//count total files to be downloaded
	for(i=count=0;i<inputs.length;i++) {
		if(inputs[i].checked) count++;
	}

	//add downloads to list
	var downloads=[];
	for(i=0;i<inputs.length;i++) {
		if(inputs[i].checked) {
			//save this file
			d=data[i];
			downloads.push({url:d.href,fileName:d.download});
		}
	}
	
	//process the downloads in the content script using the NPAPI plugin
	if(downloads.length>0) {
		downloading=true;
		btnDownload.disabled=true;
		btnChange.disabled=true;
		btnUseDefault.disabled=true;

		safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("processDownloads",{folder:folder,downloads:downloads});
	}
}

window.onload=init;
