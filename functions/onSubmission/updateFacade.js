const functions = require('firebase-functions');
const admin = require('firebase-admin');

/* admin is initialised in index.js*/
let db = admin.firestore();


exports.updateFacade = functions
  .region('asia-east2')
  .firestore
  .document('Cache/{cacheID}')
  .onCreate((snapshot, context) => 

  { 
    userData=snapshot.data()
    action=userData["action"]    

    flowID=userData["flowID"]
    stepID=userData["stepID"]
    user_name=userData["by"]["name"]
    commentText=""
    if("commentMeta" in userData)
    {
      commentText=userData["commentMeta"]["comment"]
    }
    
    stepInfoPromise=getStepInfo(flowID,stepID)
    stepStructure=null
    stepInfoPromise.then((snapshot)=>{

      //console.log(snapshot.data())
      stepStructure=snapshot.data()
      return 0

    }).catch((error)=>{console.error(error.message)})

    
    stepInfoPromise.finally(()=>{

      targetStepIndex=null

      if(action==="approved")
      {
        targetStepIndex=stepStructure["nextStep"]
      }
      if(action==="rejected")
      {
        targetStepIndex=stepStructure["previousStep"]
      }

      currentStepName=stepStructure["name"]


      if(!("fields" in stepStructure))
      {
        //There are no fields in the step
        return 0;
      }
      

      fields=stepStructure["fields"]
      if(fields.length===0)
      {
        //The fields array is empty
        return 0;
      } 

      if(!("fieldValues" in userData))
      {
        //There are no fieldValues in the userData
        return 0;
      }
      

      fieldValues=userData["fieldValues"]
      if(fieldValues.length===0)
      {
        //The fieldValues array is empty
        return 0;
      } 
      
      newSearchTerms=[]
      
      
      stepData={}
      stepData["fields"]=fields
      stepData["fieldValues"]=fieldValues
      newSearchTerms=getNewSearchTerms(stepData)
      //console.log(newSearchTerms)
      if(newSearchTerms.length>0)
      {
        //There are some new search terms
        //Get the existing ones, they may not exist
        //Or it is possible the same labels have different values
        flowMetaPromise=getFlowMeta(flowID)
        flowMeta=null
        flowMetaPromise.then((doc)=>{
          flowMeta=doc.data()

          return 0
        }).catch((error)=>{console.error(error.message)})

        flowMetaPromise.finally(()=>{

          existingSearchTerms=[]
          if(("searchTerms" in flowMeta))
          {
            existingSearchTerms=flowMeta["searchTerms"]

          }
          //console.log(existingSearchTerms)
          uSearchTerms=appendSearchTerms(newSearchTerms, existingSearchTerms)
          newflowMeta={}
          //console.log(uSearchTerms)
          newflowMeta["ready"]=true
          newflowMeta["searchTerms"]=uSearchTerms
          db.collection("Workflows").doc(flowID).update(newflowMeta)

          // We can create the Notification Object Here
            notificationObject={}
            notificationObject["actioner"]=user_name
            notificationObject["notify"]=[]
            notificationObject["action"]=action
            notificationObject["flowID"]=flowID
            notificationObject["targetStepIndex"]=targetStepIndex
            notificationObject["stepName"]=currentStepName
            notificationObject["timestamp"]=Date.now();

            notificationObject["searchTerms"]=uSearchTerms
            notificationObject["comment"]=commentText
            console.log(notificationObject)
            db.collection("NotificationQueue").doc().set(notificationObject);

          

        })

      }

      

    })





    return 0
    
  });

  function createNotificationDocument()
  {

  }

  async function getFlowMeta(flowID)
  {
    return await db.collection("Workflows").doc(flowID).get()
  }

  function getNewSearchTerms(lstepData)
  {

    fields=lstepData["fields"]
    fieldValues=lstepData["fieldValues"]
    newSearchTerms=[]
    for(index=0;index<fields.length;index++)
    {
        if(!("isSearchTerm" in fields[index]))
        {
          continue
        }
        isSearchTerm=fields[index]["isSearchTerm"]
        if(!isSearchTerm)
        {
          continue;
        }
        searchTerm={}
        searchTerm["label"]=fields[index]["label"]
        searchTerm["value"]=fieldValues[index]
        newSearchTerms.push(searchTerm)



    }

    return newSearchTerms
  }

  async function getStepInfo(flowID, stepID)
  {

    stepInfoPromise=await db.collection("Workflows")
                            .doc(flowID)
                            .collection("steps")
                            .doc(stepID)
                            .get()

     return stepInfoPromise

  }

function addSearchTermsToFlow(flowID,searchTerms)
{
  meta={}
  meta["searchTerms"]=searchTerms
  db.collection("Workflows").doc(flowID).update(meta);
}

function appendSearchTerms(newSearchTerms, existingSearchTerms)
{
  
  //newSearchTerms=existingSearchTerms;
  //console.log(newSearchTerms)
  updatedSearchTerms=existingSearchTerms
  eLength=existingSearchTerms.length
  newCount=newSearchTerms.length
  for(index=0;index<newCount;index++)
  {
        nLabel=newSearchTerms[index]["label"]
        nValue=newSearchTerms[index]["value"]
        //existing=false
        /*for(a=0;a<eLength;a++)
        {
          
          eLabel=existingSearchTerms[a]["label"]

          if(eLabel===nLabel)
          {
            updatedSearchTerms[a]["value"]=nValue
            existing=true
            break;
          }
          
        }*/

        termIndex=findWithAttr(existingSearchTerms,"label", nLabel)
        if(termIndex===-1)
        {
          updatedSearchTerms.push(newSearchTerms[index])
        }
        else
        {
          updatedSearchTerms[termIndex]["value"]=nValue
        }
      
    
  }
  //console.log(newSearchTerms)
  return updatedSearchTerms;
}

function findWithAttr(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }
    return -1;
}

  

