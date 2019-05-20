const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const lambda = new AWS.Lambda({
    region: "us-west-2"
});
import * as dynamoDbLib from "./../libs/dynamodb-lib";
import { success, failure } from "./../libs/response-lib";

export async function main(event, context) {
    let dynamoParams = {
        TableName: process.env.tableName,
        // 'KeyConditionExpression' defines the condition for the query
        // - 'userId = :userId': only return items with matching 'userId'
        //   partition key
        // 'ExpressionAttributeValues' defines the value in the condition
        // - ':userId': defines 'userId' to be Identity Pool identity id
        //   of the authenticated user
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
            ":userId": event.requestContext.identity.cognitoIdentityId
        }
    };

    async function queryNotes() {
        dynamoDbLib.call("query", dynamoParams);
    }

    async function gatherNotes(notes) {
        let notesArray = ["Content,SourceText,SourceURL"];
        for (let note in notes) {
            notesArray.push(notes[note].content + ", , ");
        }
        let csvString = notesArray.join("\n");
        return csvString;
    }

    async function uploadNotes(csvBody) {
        console.log("line 38: \n", csvBody);
        let csvBuffer = "";
        Promise.resolve(csvBody).then(value => {
            csvBuffer = value;
        })
        // const csvBuffer = Buffer.from(csvBody, 'utf8');
        console.log("line 40: \n", csvBuffer);
        let params = {Bucket: 'whitebard-app-mono-uploads-dev-whitebardcsvbucket-tf345c6q7pae', Key: 'private/' + event.requestContext.identity.cognitoIdentityId + '/notes.csv', Body: csvBuffer};
        console.log("line 41: s3");
        // console.log("line 42: csvBuffer: \n" + csvBuffer);
         await s3.upload(params, function(err, data) {
            console.log("s3.upload function happening here");
            if (err) console.log(err, err.stack); // an error occurred
            else console.log(data);               // successful response
        })
    }

    // let result = {};
    let csvString = "";

    try {
       const result = await dynamoDbLib.call("query", dynamoParams);
       const corpus = gatherNotes(result.Items);
       uploadNotes(corpus);
        return success({ status: true });
    } catch (e) {
        console.log("line 59", e);
        return failure({ status: false });
    }
}