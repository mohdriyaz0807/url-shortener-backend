const cors = require('cors')
const express = require("express");
const mongodb = require("mongodb");
const nodemailer = require("nodemailer")
const bcrypt=require('bcrypt')
const jwt = require('jsonwebtoken')
const auth = require('./middleware/token')

require('dotenv').config()

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID


const app = express();
const dbURL = process.env.DB_URL ||"mongodb://127.0.0.1:27017";
const port = process.env.PORT || 3000
app.use(cors())
app.use(express.json());

app.post("/register", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("userRegistration");
      let result = await db
        .collection("user")
        .findOne({ email: req.body.email });
      if (result) {
        res.status(400).json({ message: "User already registered" ,icon :'warning'});
      } else {
        let salt = await bcrypt.genSalt(15);
        let hash = await bcrypt.hash(req.body.password, salt);
        req.body.password = hash;

        let verifyString = (Math.random() * 1e32).toString(36)
        let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false, 
                auth: {
                  user: process.env.MAIL_USERNAME, 
                  pass: process.env.MAIL_PASSWORD, 
                },
            });

        let info = await transporter.sendMail({
                from: `Mohamed Riyaz <${process.env.MAIL_USERNAME}>`, 
                to: `${req.body.email}`, 
                subject: "Verification mail",
                text: "click to Verify your email and activate your account", 
                html: `<b>Click on the link to verify your email <a href="http://localhost:3000/confirm/${verifyString}">Click here</a></b>`,
            });

        await db.collection("user").insertOne(req.body);
        await db.collection("user").updateOne({"email": req.body.email},
        {$set: {verifystring: verifyString}})
        res.status(200).json({ message: "Check your mail for activation link" ,icon :'success' });
        clientInfo.close();
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.get('/confirm/:verifyString', async (req, res) => {
    try {
        let clientInfo = await mongoClient.connect(dbURL)
        let db = clientInfo.db("userRegistration")
        let result = await db.collection("user").findOne({ verifystring: req.params.verifyString})
        if (result) {
                await db.collection("user").updateOne({
                    verifystring: req.params.verifyString
                }, {
                    $set: {
                        status: true,
                        verifystring: ''
                    }
                })
                res.send('<h1>Your account is activated. Now go to Login Page.</h1>')
                clientInfo.close()
        } else {
            res.send('<h1>Link has expired</h1>')
            clientInfo.close()
        }
    } catch (error) {
        console.log(error)
    }
})
  
  app.post("/login", async (req, res) => {
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("userRegistration");
      let result = await db
        .collection("user")
        .findOne({$and:[{ email: req.body.email },{status:true}]});
      if (result) {
        let isTrue = await bcrypt.compare(req.body.password, result.password);
        if (isTrue) {
          let token = await jwt.sign({"userid":result._id,"username":result.username},process.env.TOKEN_PASS)
          res.status(200).json({ message: "Logged in successfully",result ,token,icon :'success'})
          clientInfo.close();
        } else {
          res.status(200).json({ message: "Incorrect Password" ,icon :'warning' });
        }
      } else {
        res.status(400).json({ message: "User not registered" ,icon :'warning' });
      }
    } catch (error) {
      console.log(error);
    }
  })

  app.put('/shorturl/:id',async (req,res)=>{
    try{
      let clientInfo = await mongoClient.connect(dbURL)
        let db = clientInfo.db("userRegistration")
        let result = await db.collection("user").findOne({
            _id: objectId(req.params.id)
        })
        if(result){
          await db.collection("user").updateOne({
            "_id": objectId(req.params.id)
        }, {
            $push: {"url": {longURL: req.body.longURL,shortURL: req.body.shortURL,count: 0 }}
        })
        res.status(200).json({message: "User found, data updated",})
        }else{
          res.status(404).json({message: "User not found, data not updated"})
        }
    }catch(err){
      console.log(err);
    }
  })


  app.get('/dashboard/:id',auth, async (req, res) => {
    try {
        let clientInfo = await mongoClient.connect(dbURL)
        let db = clientInfo.db('userRegistration')
        let result = await db.collection('user').findOne({
            _id: objectId(req.params.id)
        })
        if (result) {
            res.status(200).json(result)
        } else {
            res.send('<h1>Link has expired</h1>')
        }
    } catch (error) {
        console.log(error)
    }
})

app.get('/getLongUrl/:str', async (req, res) => {
  try {
      let clientInfo = await mongoClient.connect(dbURL)
      let db = clientInfo.db("userRegistration")
      let result = await db.collection("user").findOne({
              "url.shortURL": { "$in": [req.params.str]}
          }, {projection: {"url": {$elemMatch: {shortURL: req.params.str } }
              }
          })
      if (result) {
          await db.collection("user").updateOne({
              "url.shortURL": {"$in": [req.params.str]}}, 
              { $inc: { "url.$.count": 1 } })
          res.redirect(result.url[0].longURL)
      } else {
          res.status(400).json({
              message: "Not found url"
          })
      }
  } catch (error) {
    console.log(error);
  }
})

  app.post('/forgot',async (req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("userRegistration");
      let result = await db.collection("user").findOne({ email: req.body.email })

      if (result) {
        let random=(Math.random()*1e32).toString(36)

        let transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false, 
          auth: {
            user: process.env.MAIL_USERNAME, 
            pass: process.env.MAIL_PASSWORD, 
          },
        })
        let info = await transporter.sendMail({
          from: `Mohamed Riyaz <${process.env.MAIL_USERNAME}>`, 
          to: `${req.body.email}`, 
          subject: "Password Reset", 
          text: "Reset your password", 
          html: `<b>Click below to reset your password</b><br> <a href='https://reset-password.netlify.app/new_password.html?random=${random}'>Reset</a>`
        })
        await db.collection("user").updateOne({ email: req.body.email },{$set:{'randomstring':random}});
        res.status(200).json({message: `Thanks! Please check ${req.body.email} for a link to reset your password.`,icon:'success'});
        clientInfo.close()
      }
      else{
        res.status(400).json({message: "User doesn't exists",icon:'warning'});
      }
    }
    catch(err){
      console.log(err);
    }
  })

  app.post('/reset',async(req,res)=>{
    try {
      let clientInfo = await mongoClient.connect(dbURL);
      let db = clientInfo.db("userRegistration");
      let result = await db.collection("user").findOne({randomstring : req.body.randomstring})
      if(result){
        let salt = await bcrypt.genSalt(15);
        let password = await bcrypt.hash(req.body.password, salt);
        await db.collection("user").updateOne({
        randomstring: req.body.randomstring}, {$set: {
                    randomstring: '',
                    password: password
                }})
        res.status(200).json({message: "Password Changed successfully" ,icon :'success'});
        clientInfo.close();
      }else{
        res.status(410).json({message: "some error in page" ,icon :'error'});
      }
  }
  catch(err){
    console.log(err);
  }
  })



app.listen(port, () => console.log("your app runs with port:",port));
