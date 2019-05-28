const AWS = require("aws-sdk");
import * as dynamoDbLib from "./../libs/dynamodb-lib";
import { success, failure } from "./../libs/response-lib";
const async = require("async");

const s3 = new AWS.S3();

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

    function gatherNotes(notes) {
        let notesArray = ["Content,SourceText,SourceURL"];
        for (let note in notes) {
            notesArray.push(notes[note].content + ", , ");
        }
        let csvString = notesArray.join("\n");
        return csvString;
    }

    async function uploadNotes(csvBody) {
        let csvBuffer = Buffer.from(csvBody);
        let params = {
            ACL: "public-read",
            Bucket: 'whitebard-app-mono-uploads-dev-whitebardcsvbucket-tf345c6q7pae',
            Key: 'private/' + event.requestContext.identity.cognitoIdentityId + '/notes.csv',
            Body: csvBuffer
        };
        console.log(csvBuffer.toString());
        console.log("s3.upload function about to run");
        await s3.upload(params, function (err, data) {
            console.log("s3.upload function happening here");
            if (err) console.log(err, err.stack); // an error occurred
            else console.log(data);               // successful response
        }).promise()
    }

    try {
        // query user's notes
        const result = await dynamoDbLib.call("query", dynamoParams);
        // join the notes contents into a string
        console.log("csvBucket name: ", JSON.stringify(process.env.csvBucket));
        const corpus = gatherNotes(result.Items);
        // pass the string to a function that will call s3.upload and use the corpus as the value for the body property of the params object
        await uploadNotes(corpus);
        return success({ status: true });
    } catch (e) {
        console.log("line 59", e);
        return failure({ status: false });
    }
}