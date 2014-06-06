#import <stdint.h>
#import "downloadNPObject.h"
#import <QTKit/QTKit.h>
#import <WebKit/npfunctions.h>

extern NPNetscapeFuncs* browser;


enum {
    ID_FOLDER,
    ID_DOWNLOAD,
    ID_DEFAULTFOLDER,
    NUM_METHOD_IDENTIFIERS
};

static NPIdentifier methodIdentifiers[NUM_METHOD_IDENTIFIERS];
static const NPUTF8 *methodIdentifierNames[NUM_METHOD_IDENTIFIERS] = {
    "folder",
    "download",
    "defaultfolder",
};

static void initializeIdentifiers(void)
{
    static bool identifiersInitialized;
    if (identifiersInitialized)
        return;

    // Take all method identifier names and convert them to NPIdentifiers.
    browser->getstringidentifiers(methodIdentifierNames, NUM_METHOD_IDENTIFIERS, methodIdentifiers);
    identifiersInitialized = true;
}

static NPObject *downloadNPObjectAllocate(NPP npp, NPClass* theClass)
{
    initializeIdentifiers();

    DownloadNPObject *downloadNPObject = browser->memalloc(sizeof(DownloadNPObject));

    return (NPObject *)downloadNPObject;
}

static void downloadNPObjectDeallocate(NPObject *npObject)
{
    DownloadNPObject *downloadNPObject = (DownloadNPObject *)npObject;

    // Free the NPObject memory.
    browser->memfree(downloadNPObject);
}

static bool downloadNPObjectHasMethod(NPObject *obj, NPIdentifier name)
{
    // Loop over all the method NPIdentifiers and see if we expose the given method.
    for (int i = 0; i < NUM_METHOD_IDENTIFIERS; i++) {
        if (name == methodIdentifiers[i])
            return true;
    }

    return false;
}

//alternate version of STRINGZ_TO_NPVARIANT to compensate for Webkit library bug
#define STRINGZ_TO_NPVARIANT2(_val, _v)                                       \
NP_BEGIN_MACRO                                                                \
    (_v).type = NPVariantType_String;                                         \
    NPString str = { _val, (uint32_t)(strlen(_val)) };                        \
    (_v).value.stringValue = str;                                             \
NP_END_MACRO

//convert an NPVariant string to a memory allocated char string
char *npVarToChar(NPVariant var) {
    NPString s=var.value.stringValue;
    char *result = (char *)browser->memalloc(s.UTF8Length+1);
    if (!result) return NULL;
    //use the length because the string may not be zero terminated
    strncpy(result,s.UTF8Characters,s.UTF8Length);
    result[s.UTF8Length]=0;

    return result;
}

static bool downloadNPObjectInvoke(NPObject *npObject, NPIdentifier name, const NPVariant* args, uint32_t argCount, NPVariant* result)
{
    DownloadNPObject *downloadNPObject = (DownloadNPObject *)npObject;
    
    if(name==methodIdentifiers[ID_DOWNLOAD]) {
        const char *statusMsg;
        
        //check to see if already downloading
        if(downloadNPObject->status==0) {
            //not currently downloading, so start new download
            downloadNPObject->status=1;
            
            //store save folder and filename for NPP_StreamAsFile to use during save
            downloadNPObject->baseDir=npVarToChar(args[0]);
            downloadNPObject->fileName=npVarToChar(args[1]);
            
            //send request to browser to download the file to a temp file
            const char *url=npVarToChar(args[2]);
            browser->geturlnotify(downloadNPObject->npp,url,NULL,downloadNPObject);
            
            //set status message to "downloading"
            statusMsg="downloading";
        } else {
            //downloading, so just return "busy" status
            statusMsg="busy";
        }
        
        //return status message
        char *resultString=(char *)browser->memalloc(strlen(statusMsg)+1);
        if (!resultString) return false;
        strcpy(resultString,statusMsg);
        STRINGZ_TO_NPVARIANT2(resultString, *result);
        return true;
        
    } else if(name==methodIdentifiers[ID_FOLDER]) {
        NSString *dirNS;
        
        //if a default directory was sent, use that as the opening directory
        if(argCount > 0) {
            NPString s=args[0].value.stringValue;
            //be sure to only use the length here, because the string may not be zero terminated
            dirNS=[NSString stringWithCString:s.UTF8Characters length:s.UTF8Length];
        }
        
        //open the save directory chooser
        NSOpenPanel *panel;
        panel = [NSOpenPanel openPanel];
        [panel setFloatingPanel:YES];
        [panel setCanChooseDirectories:YES];
        [panel setCanChooseFiles:NO];
        [panel setAllowsMultipleSelection:NO];
        
        //set the default opening directory here, if any sent from the browser
        if(argCount>0) {
            [panel setDirectoryURL:[NSURL fileURLWithPath:dirNS isDirectory:true]];
        }
        
        //open the dialog
        int i = [panel runModal];
        
        //if a directory was selected, return it in the result
        if(i == NSOKButton){
            //return selected folder
            const char *path=[[[panel URL] path] UTF8String];
            char* resultString = (char *)browser->memalloc(strlen(path)+1);
            if (!resultString) return false;
            strcpy(resultString,path);
            STRINGZ_TO_NPVARIANT2(resultString, *result);
            
        }
        return true;
        
    } else if(name==methodIdentifiers[ID_DEFAULTFOLDER]) {
        //get the default downloads folder
        NSArray *paths=NSSearchPathForDirectoriesInDomains(NSDownloadsDirectory, NSUserDomainMask, YES);
        
        //return default folder
        const char *path=[[paths objectAtIndex:0] UTF8String];
        char* resultString = (char *)browser->memalloc(strlen(path)+1);
        if (!resultString) return false;
        strcpy(resultString,path);
        STRINGZ_TO_NPVARIANT2(resultString, *result);
        return true;
    }

    return false;
}

static NPClass downloadNPClass = {
    NP_CLASS_STRUCT_VERSION,
    downloadNPObjectAllocate, // NP_Allocate
    downloadNPObjectDeallocate, // NP_Deallocate
    0, // NP_Invalidate
    downloadNPObjectHasMethod, // NP_HasMethod
    downloadNPObjectInvoke, // NP_Invoke
    0, // NP_InvokeDefault
    0, // NP_HasProperty
    0, // NP_GetProperty
    0, // NP_SetProperty
    0, // NP_RemoveProperty
    0, // NP_Enumerate
    0, // NP_Construct
};

NPObject *createDownloadNPObject(NPP npp)
{
    DownloadNPObject *downloadNPObject = (DownloadNPObject *)browser->createobject(npp, &downloadNPClass);

    downloadNPObject->npp=npp;
    downloadNPObject->status=0;

    return (NPObject *)downloadNPObject;
}
