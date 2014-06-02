//global vars
var bgnd=chrome.extension.getBackgroundPage();
var data;

//document elements
var chkAll,chkNone,list,table,txtPath,btnDownload,btnChange;

//initialize routine
function init() {
	//initialize path folder edit box
	txtPath=document.getElementById("txtPath");
	txtPath.addEventListener("input",checkPath);

	//initialize button that downloads the selected files
	btnDownload=document.getElementById("btnDownload");
	btnDownload.addEventListener("click",download);

	//initialize button that allows changing/restoring the path
	btnChange=document.getElementById("btnChange");
	btnChange.addEventListener("click",changePath);
	
	//get previously used path, if any
	path=localStorage["path"];
	if(!path) {
		//no path stored so just use downloads folder
		txtPath.value="Browser default";
		txtPath.disabled=true;
		txtPath.setAttribute("class","hideBox");
		btnChange.textContent="Change";
	} else {
		//use previous path
		txtPath.value=path;
		txtPath.disabled=false;
		txtPath.setAttribute("class","");
		btnChange.textContent="Use Default";
	}
	
	//initialize select/unselect checkbox
	chkAll=document.getElementById("chkAll");
	chkAll.addEventListener("click",selectUnselect);
	chkNone=document.getElementById("chkNone");
	chkNone.addEventListener("click",selectUnselect);
	
	//initialize list
	list=document.getElementById("list");
	getFiles(function() {
		populateList();
	});
}

function checkPath() {
	//validate paths
	var v=txtPath.value;
	if(/(^(\s|\\|\/|\.)|[<>:"|?*]|((\\|\/|\.)(\\|\/|\.))|(\s|\\|\/)$)/.test(v)) {
		txtPath.style.color="#f00";
	} else {
		txtPath.style.color="#000";
		localStorage["path"]=txtPath.value;
	}
}

function changePath() {
	if(txtPath.disabled) {
		//enable custom folder editing
		txtPath.disabled=false;
		if(path) {
			txtPath.value=path;
		} else {
			txtPath.value="";
		}
		btnChange.textContent="Use Default";
	} else {
		//use default downloads folder
		txtPath.value="Browser default";
		txtPath.disabled=true;
		btnChange.textContent="Change";
		localStorage.removeItem("path");
	}
}

function selectUnselect() {
	var checked=this.id=="chkAll";
	var inputs=table.querySelectorAll("input");
	var i;
	for(i=0;i<inputs.length;i++) {
		inputs[i].checked=checked;
	}
}

//request list from content_script
function getFiles(callback) {
	chrome.tabs.query({"active":true,"currentWindow":true},function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id,{"getFiles":true},function(response) {
			data=response.data;
			console.log("data received:"+data.length);
			if(callback) callback();
		});
	});
}

function populateList() {
	var th,tr,td,input,txt,a;
	var i,d;
	
	//remove table if exists
	if(table) list.removeChild(table);
	
	//create new table
	table=document.createElement("table");
	list.appendChild(table);
	
	//create table row for each file
	for(i=0;i<data.length;i++) {
		d=data[i];
//		console.log("href:"+d.href+"  download:"+d.download+"  text:"+d.text);
		
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
		txt=document.createTextNode(d.download);
		td.className = "download";
		td.appendChild(txt);
		
		//create href link cell
		/*td=document.createElement("td");
		td.setAttribute("class","linkCellWidth");
		tr.appendChild(td);
		a=document.createElement("a");
		a.setAttribute("href",d.href);
		a.setAttribute("target","_blank");
		td.appendChild(a);
		txt=document.createTextNode(d.href);
		a.appendChild(txt);*/
		
		//create link description cell
		td=document.createElement("td");
		tr.appendChild(td);
		txt=document.createTextNode(d.text);
		td.appendChild(txt);
	}
	
}

function download() {
	var inputs=table.querySelectorAll("input");
	var i,d,count;
	var path=localStorage["path"];

	//add the slash to the end of the path if it exists
	path=(path==undefined?"":path+"/");
	
	//count total files to be downloaded
	for(i=count=0;i<inputs.length;i++) {
		if(inputs[i].checked) count++;
	}

	for(i=0;i<inputs.length;i++) {
		if(inputs[i].checked) {
			//save this file
			d=data[i];
			console.log("download:"+JSON.stringify({"filename":path+d.download,"conflictAction":"uniquify"}));
			chrome.downloads.download({"url":d.href,"filename":path+d.download,"conflictAction":"uniquify"}, function(downloadId) {
				count--;
				if(count==0) window.close();
			});
		};
	}
	

}

window.onload=init;
