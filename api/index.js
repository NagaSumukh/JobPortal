var Express = require("express");
var Mongoclient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId; 
var cors=require("cors");
const bodyParser = require('body-parser'); 
const multer = require("multer");
const mongoose = require('mongoose');

var app = Express();
app.use(cors());
app.use(bodyParser.json()); 

var CONNECTION_STRING = "mongodb+srv://admin:admin123@cluster0.whh2ete.mongodb.net/?retryWrites=true&w=majority"


var DATABASENAME = "jobportal";
var database;

app.listen(5038, ()=>{
    Mongoclient.connect(CONNECTION_STRING, (error, client) => {
        if (error) {
            console.error("Error connecting to MongoDB:", error);
            return;
        }
        database = client.db(DATABASENAME);
        console.log("Mongo DB Connection is Successful");
    });
})

app.get('/api/jobportal/getjobs', (request, response) => {
    database.collection("jobpostings").find({}).toArray((error, result) => {
        if (error) {
            console.error("Error fetching job postings:", error);
            response.status(500).send("Internal Server Error");
        } else {
            response.send(result);
        }
    });
})

app.get('/api/jobportal/companyJobCount', (request, response) => {
    database.collection("jobpostings").aggregate([
        {
            $group: {
                _id: "$companyname",
                count: { $sum: 1 }
            }
        }
    ]).toArray((error, result) => {
        if (error) {
            console.error("Error fetching company job counts:", error);
            response.status(500).send("Internal Server Error");
        } else {
            response.send(result);
        }
    });
});

app.get('/api/jobportal/companyJobCountInterviews', (request, response) => {
    database.collection("jobinterviews").aggregate([
        {
            $group: {
                _id: "$companyname",
                count: { $sum: 1 }
            }
        }
    ]).toArray((error, result) => {
        if (error) {
            console.error("Error fetching company job counts:", error);
            response.status(500).send("Internal Server Error");
        } else {
            response.send(result);
        }
    });
});

app.get('/api/jobportal/getOnlyMyJobs', async (request, response) => {
    const recruiterUsername = request.query.recruiter;

    try {
        let query = {};

        // If a recruiter username is provided, filter jobs for that recruiter
        if (recruiterUsername) {
            query = { recruiter: recruiterUsername };
        }

        const result = await database.collection("jobpostings").find(query).toArray();

        response.json(result);
    } catch (error) {
        console.error("Error fetching job postings:", error);
        response.status(500).send("Internal Server Error");
    }
});


app.post('/api/jobportal/addjobs', multer().none(), (request, response) => {
    database.collection("jobpostings").count({}, function (error, numOfDocs) {
        const jobData = {
            jobid: (numOfDocs + 1).toString(),
            companyname: request.body.companyname,
            jobname: request.body.jobname,
            jobdescription: request.body.jobdescription,
            mailid: request.body.mailid,
            skillsset: request.body.skillsset,
            recruiter: request.body.recruiter
        };
        database.collection("jobpostings").insertOne(jobData, (error) => {
            if (error) {
                response.status(500).json("Error adding job");
            } else {
                response.json("Added Successfully");
            }
        });
    });
});

app.delete('/api/jobportal/deletejobs', async (request, response) => {
    const jobId = request.query.id;

    if (!jobId) {
        return response.status(400).json("Invalid or missing job ID");
    }

    try {
        const result = await database.collection("jobpostings").deleteOne({ _id: new ObjectId(jobId) });

        if (result.deletedCount === 0) {
            return response.status(404).json("No job found with the specified ID");
        }

        console.log("Job deleted successfully:", jobId);
        response.json("Deleted Successfully");
    } catch (error) {
        console.error("Error deleting job:", error);
        response.status(500).json("Error deleting job");
    }
});


app.get('/api/jobportal/searchjobs', (request, response) => {
    const searchQuery = request.query.q;

    if (!searchQuery) {
        return response.status(400).json("Invalid or missing search query");
    }

    const regexQuery = new RegExp(searchQuery, 'i');

    database.collection("jobpostings").find({
        $or: [
            { companyname: { $regex: regexQuery } },
            { jobname: { $regex: regexQuery } },
            { jobdescription: { $regex: regexQuery } },
            { mailid: { $regex: regexQuery } },
            { skillsset: { $regex: regexQuery } }
        ]
    }).toArray((error, result) => {
        if (error) {
            console.error("Error searching for jobs:", error);
            response.status(500).json("Error searching for jobs");
        } else {
            response.json(result);
        }
    });
});



app.post('/api/jobportal/register', multer().none(), async (request, response) => {
    const { username, password, role } = request.body;
  
    try {
      // Check if the username already exists
      const existingUser = await database.collection("users").findOne({ username });
      if (existingUser) {
        return response.status(400).json({ message: 'Username already exists' });
      }
      
      // Create a new user
      const newUser = {
        username,
        password, // You should hash the password before storing it in the database for security
        role,
      };
  
      await database.collection("users").insertOne(newUser);
      response.status(200).json({ message: 'Registration successful' });
    } catch (error) {
      console.error('Registration error:', error);
      response.status(500).json({ message: 'Internal Server Error' });
    }
});


app.post('/api/jobportal/login', multer().none(), async (request, response) => {
    const { username, password } = request.body;
  
    try {
      // Check if the user exists
      const user = await database.collection("users").findOne({ username });
  
      if (!user) {
        return response.status(401).json({ message: 'Invalid credentials' });
      }
  
      // Check if the provided password matches the stored password (you should hash passwords for security)
      if (user.password !== password) {
        return response.status(401).json({ message: 'Invalid credentials' });
      }
  
      // Log in successful
      response.status(200).json({ message: 'Login successful', user });
    } catch (error) {
      console.error('Login error:', error);
      response.status(500).json({ message: 'Internal Server Error' });
    }
  });
  


app.post('/api/jobportal/apply', multer().none(), async (request, response) => {
    const { appliedUsername, recruiterUsername, jobIdToAdd } = request.body;
    console.log('Request Body:', request.body);
    console.log("Job ID is ",jobIdToAdd);
    try {
        const job = await database.collection("jobpostings").findOne({ jobid: jobIdToAdd });

        if (!job) {
            return response.status(404).json({ message: 'Job not found with the specified ID' });
        }

        // Check if the applied username and recruiter username are valid (you might want to perform additional checks)
        // For simplicity, assume they are valid for now

        // Create a new job application
        const jobApplication = {
            appliedUsername,
            recruiterUsername,
            jobIdToAdd,
        };

        // Store the job application in the "jobapplications" collection
        await database.collection("jobapplications").insertOne(jobApplication);

        response.status(200).json({ message: 'Job application successful' });
    } catch (error) {
        console.error('Job application error:', error);
        response.status(500).json({ message: 'Internal Server Error' });
    }
});


app.get('/api/jobportal/getAppliedJobs', async (request, response) => {
    const appliedUsername = request.query.username;

    if (!appliedUsername) {
        return response.status(400).json("Invalid or missing applied username");
    }

    try {
        const result = await database.collection("jobapplications").find({ appliedUsername }).toArray();

        response.json(result);
    } catch (error) {
        console.error("Error fetching applied jobs:", error);
        response.status(500).json("Internal Server Error");
    }
});


app.get('/api/jobportal/getApplicantsDetails', async (request, response) => {
    const jobId = request.query.jobId;
    // console.log("XX - jobid ",jobId);
    if (!jobId) {
        return response.status(400).json("Invalid or missing job ID");
    }

    try {
        const applicants = await database.collection("jobapplications").find({ jobIdToAdd: jobId }).toArray();
        response.json(applicants);
        // console.log("Applicants is ",applicants);
    } catch (error) {
        console.error("Error fetching applicants details:", error);
        response.status(500).json("Internal Server Error");
    }
});


app.get('/api/jobportal/getApplicantsCount', async (request, response) => {
    const recruiterUsername = request.query.recruiter;

    if (!recruiterUsername) {
        console.log("Invalid or missing recruiter username");
        return response.status(400).json("Invalid or missing recruiter username");
    }

    try {
        const jobs = await database.collection("jobpostings").find({ recruiter: recruiterUsername }).toArray();

        const applicantsCount = [];

        for (const job of jobs) {
            try {
                const count = await database.collection("jobapplications").countDocuments({ jobIdToAdd: job.jobid });
                applicantsCount.push({ jobRealId:job._id, jobId: job.jobid, count });
              } catch (error) {
                console.error("Error counting documents:", error);
              }              
        }

        // console.log("Applicants Count:", applicantsCount);
        response.json(applicantsCount);
    } catch (error) {
        console.error("Error fetching applicants count:", error);
        response.status(500).json("Internal Server Error");
    }
});



app.get('/api/jobportal/getJobInterviews', async (request, response) => {
    const applicantId = request.query.applicantId;

    if (!applicantId) {
        return response.status(400).json("Invalid or missing applicant ID");
    }

    try {
        const result = await database.collection("jobinterviews").find({ applicantId }).toArray();
        response.json(result);
    } catch (error) {
        console.error("Error fetching job interviews:", error);
        response.status(500).json("Internal Server Error");
    }
});


app.post('/api/jobportal/saveInterview', multer().none(), async (request, response) => {
    const { appliedJobId, appliedUsername, interviewData, callLink,companyname } = request.body;

    try {
        await database.collection("jobinterviews").insertOne({
            appliedJobId,
            appliedUsername,
            interviewData: {
                date: interviewData.date,
                interviewerInformation: {
                    name: interviewData.interviewerName,
                    position: interviewData.interviewerPosition,
                    contact: interviewData.interviewerContact,
                },
            },
            timestamp: new Date(),
            callLink,
            companyname: companyname
        });

        response.status(200).json("Interview saved successfully");
    } catch (error) {
        console.error('Error saving interview:', error);
        response.status(500).json("Internal Server Error");
    }
});

app.get('/api/jobportal/getCompanyNameByJobId', async (request, response) => {
    const jobId = request.query.jobId;

    if (!jobId) {
        return response.status(400).json("Invalid or missing job ID");
    }

    try {
        const job = await database.collection("jobpostings").findOne({ jobid: jobId });

        if (!job) {
            return response.status(404).json({ message: 'Job not found with the specified ID' });
        }

        const companyName = job.companyname;
        response.json({ companyName });
        console.log("Company name is",companyName);
    } catch (error) {
        console.error("Error fetching company name by job ID:", error);
        response.status(500).json("Internal Server Error");
    }
});



app.get('/api/jobportal/searchApplicationsAndInterviews', async (request, response) => {
    const jobId = request.query.jobId;

    if (!jobId) {
        return response.status(400).json("Invalid or missing job ID");
    }

    try {
        const result = await database.collection("jobapplications").aggregate([
            {
                $match: { jobIdToAdd: jobId }
            },
            {
                $lookup: {
                    from: "jobinterviews",
                    localField: "jobIdToAdd",
                    foreignField: "appliedJobId",
                    as: "interviews"
                }
            },
            {
                $lookup: {
                    from: "jobpostings",
                    localField: "jobIdToAdd",
                    foreignField: "jobid",
                    as: "job"
                }
            },
            {
                $project: {
                    _id: 1,
                    appliedUsername: 1,
                    recruiterUsername: 1,
                    jobIdToAdd: 1,
                    job: { $arrayElemAt: ["$job", 0] },
                    interviews: 1
                }
            }
        ]).toArray();
        console.log("Result is ",result);
        response.json(result);
    } catch (error) {
        console.error("Error searching applications and interviews:", error);
        response.status(500).json("Internal Server Error");
    }
});



app.get('/api/jobportal/searchJobWithApplicationsAndInterviews', async (request, response) => {
    const jobId = request.query.jobId;

    if (!jobId) {
        return response.status(400).json("Invalid or missing job ID");
    }

    try {
        const result = await database.collection("jobpostings").aggregate([
            {
                $match: { jobid: jobId }
            },
            {
                $lookup: {
                    from: "jobapplications",
                    localField: "jobid",
                    foreignField: "jobIdToAdd",
                    as: "applications"
                }
            },
            {
                $lookup: {
                    from: "jobinterviews",
                    localField: "jobid",
                    foreignField: "appliedJobId",
                    as: "interviews"
                }
            },
            {
                $project: {
                    jobid: 1,
                    companyname: 1,
                    jobname: 1,
                    jobdescription: 1,
                    mailid: 1,
                    recruiter: 1,
                    skillsset: 1,
                    applications: 1,
                    interviews: 1
                }
            }
        ]).toArray();
        console.log("Result is ",result);
        response.json(result);
    } catch (error) {
        console.error("Error searching job with applications and interviews:", error);
        response.status(500).json("Internal Server Error");
    }
});



app.get('/api/jobportal/searchApplicantDetails', async (request, response) => {
    
    const applicantName = request.query.applicantName;
    console.log("Applicant name is ",applicantName);
    if (!applicantName) {
        return response.status(400).json("Invalid or missing applicant name");
    }

    try {
        const result = await database.collection("jobpostings").aggregate([
            {
                $lookup: {
                    from: "jobapplications",
                    localField: "jobid",
                    foreignField: "jobIdToAdd",
                    as: "applications"
                }
            },
            {
                $lookup: {
                    from: "jobinterviews",
                    localField: "jobid",
                    foreignField: "appliedJobId",
                    as: "interviews"
                }
            },
            {
                $match: { companyname: applicantName }
            },
            {
                $project: {
                    jobid: 1,
                    companyname: 1,
                    jobname: 1,
                    jobdescription: 1,
                    mailid: 1,
                    recruiter: 1,
                    skillsset: 1,
                    applications: 1,
                    interviews: 1
                }
            }
        ]).toArray();
        console.log("Result is ", result);
        response.json(result);
    } catch (error) {
        console.error("Error searching applicant details:", error);
        response.status(500).json("Internal Server Error");
    }
});

