#import <WebKit/npruntime.h>

NPObject *createDownloadNPObject(NPP);

typedef struct {
    NPObject npObject;              //the NPObject of this object
    NPP npp;                        //plug-in instance
    const char *baseDir,*fileName;  //save folder and filename for download
    int status;                     //status of download, 0=ready, 1=downloading
} DownloadNPObject;