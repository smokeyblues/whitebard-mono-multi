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
            Bucket: process.env.csvBucket,
            Key: 'private/' + event.requestContext.identity.cognitoIdentityId + '/notes.csv',
            Body: csvBuffer
        };
        try {
            const result = await s3.upload(params).promise();
            console.log(result);
        } catch (e) {
            console.log(e);
        }
    }

    try {
        // query user's notes
        const result = await dynamoDbLib.call("query", dynamoParams);
        // join the notes contents into a string
        const corpus = gatherNotes(result.Items);
        // pass the string to a function that will call s3.upload and use the corpus as the value for the body property of the params object
        await uploadNotes(corpus);
        return success({ status: true });
    } catch (e) {
        console.log(e);
        return failure({ status: false });
    }
}