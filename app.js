//jshint esversion:6
require('dotenv').config()
const express=require("express");
const mongo = require('mongodb');

const bodyParser=require("body-parser");
const ejs=require("ejs");
const mongoose=require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require('mongoose-findorcreate');
const { compareSync } = require('bcrypt');


// const encrypt = require('mongoose-encryption');
// const md5=require("md5");
// const bcrypt = require('bcrypt');
// const saltRounds = 10;

const app=express();



app.use(express.static("public"));
app.set('view engine','ejs');

app.use(bodyParser.urlencoded({
    extended:true 
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
  }))
app.use(passport.initialize());
app.use(passport.session());
 
const dburl="mongodb+srv://"+process.env.MONGODB_USERNAME+":"+process.env.MONGODB_PASSWORD+"@cluster0.6ioio77.mongodb.net";
mongoose.connect(dburl, {useNewUrlParser: true})
.then(() => {
    console.log('Connected to MongoDB Atlas');
    // Start your application or perform database operations
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB Atlas:', error);
});
const UserSchema=new mongoose.Schema({
    email:String,
    password:String,
    googleId:String,
    "secrets": [
        {
          "_id": String,
          "content": String,
          "likes":Number,
          "dislike":Number,
          "fire":Number,
          "sad":Number
        }
      ],
});

UserSchema.plugin(passportLocalMongoose);
UserSchema.plugin(findOrCreate);
// UserSchema.plugin(encrypt,{secret:process.env.SECRET,encryptedFields:["password"] });
const User=new mongoose.model("User",UserSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/Secret"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


  
app.get("/",function(req,res){
    res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] }));

  app.get("/auth/google/Secret", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });


app.get("/login",function(req,res){
    res.render("login");
});

app.get("/register",function(req,res){
    res.render("register",{ currentPage: "wow" });
});


app.get("/secrets",async function (req, res) {

    // User.findOne({ 'secrets.0': { $exists: true } }
     // User.find({"secret":{$ne:null}}).then(function(FoundItems){
        User.find({ secrets: { $exists: true, $type: 'array', $ne: [] } }).then(function(FoundItems){
         res.render("secrets", {newItem:FoundItems});
       })
        .catch(function(err){
         console.log(err);
       })
 })
 app.get("/yourcontent",async function (req, res) {
    if(req.isAuthenticated()){
    var data = await User.findOne({_id:req.user._id});
    try{
    if(data)
    {
            res.render("yourcontent",{secrets:data.secrets});
    }
    else{
           data = await User.findOne({username:req.user});
            res.render("yourcontent",{secrets:data.secrets});
    }
    console.log("tis is data "+data);
    }
    catch(err)
    {
        console.log(err);
    }
    }
    else{
        res.redirect("/login");
    }
 })
app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
})
app.post("/submit",async(req,res)=>{
    const value=req.body.secret;
    //const secretId = mongoose.Types.ObjectId().toString();
    //let secretId = new mongoose.ObjectID()
    //var id = new Date();
    //console.log(datetime);
    const d = new Date();
    let text = d.toString();
    const newsecret = {
        likes:0,
        dislike:0,
        fire:0,
        sad:0,
        _id : text,// Generate a new ObjectId for the secret
        content: value
      };
   
    const data = await User.findOne({_id:req.user._id});
    try{
    if(data)
    {
        //data.secret=value;
        data.secrets.push(newsecret);
        console.log(data);
        data.save().then(()=>{
            res.redirect("secrets");
        }).catch((err)=>{
            console.log(err);
        })
    }
    else{
        const data = await User.findOne({username:req.user});
      
        //data.secret=value;
        data.secrets.push(newsecret);
        data.save().then(()=>{
            res.redirect("secrets");
        }).catch((err)=>{
            console.log(err);
        }) 
    }
    }
    catch(err)
    {
        console.log(err);
    }
    
})
app.get("/logout",function(req,res){
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
})

app.post("/register", function(req,res){
    //document.querySelector(".prashanth").classList.add("varun");
    User.register({username:req.body.username, active: false}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
         }
         else{
            passport.authenticate("local")(req,res,function(){
                    res.redirect("/secrets");
                });
            };
         });
      
})


app.post('/login', async (req, res) => {
    const user=new User({
        username:req.body.username,
        password:req.body.password
    });
    req.logIn(user,function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    })
})

app.post('/like', async(req, res) => {
    const secretId = req.body.secretId;
    // Find the secret by its ID
    try{
    var userID= req.user._id;
    if(!userID){
        userID=req.user;
    }
    }
    catch{
        res.redirect("secrets");
    }
   const data= await User.findOne({ 'secrets._id': secretId })
     try{
        if(data)
        {
            console.log(data);
            const secret = data.secrets.find((s) => s._id=== secretId);
            if (!secret) {
            console.error('Secret not found');
            return;
            }
            console.log(secret.content);
            secret.likes =secret.likes+1;
            console.log(secret.likes);
            data.save().then(()=>{
                res.redirect("secrets");
            }).catch((err)=>{
                console.log(err);
            })
        }
    }
    catch(err)
    {
        console.log(err);
    }
  });



  app.post('/dislike', async(req, res) => {
    const secretId = req.body.secretId;
    // Find the secret by its ID
    try{
    var userID= req.user._id;
    if(!userID){
        userID=req.user;
    }
    }
    catch{
        res.redirect("secrets");
    }
   const data= await User.findOne({ 'secrets._id': secretId })
     try{
        if(data)
        {
            console.log(data);
            const secret = data.secrets.find((s) => s._id=== secretId);
            if (!secret) {
            console.error('Secret not found');
            return;
            }
            console.log(secret.content);
            secret.dislike =secret.dislike+1;
            console.log(secret.dislikes);
            data.save().then(()=>{
                res.redirect("secrets");
            }).catch((err)=>{
                console.log(err);
            })
        }
    }
    catch(err)
    {
        console.log(err);
    }
  });
  
  
  app.post('/fire', async(req, res) => {
    const secretId = req.body.secretId;
    // Find the secret by its ID
    try{
    var userID= req.user._id;
    if(!userID){
        userID=req.user;
    }
    }
    catch{
        res.redirect("secrets");
    }
   const data= await User.findOne({ 'secrets._id': secretId })
     try{
        if(data)
        {
            console.log(data);
            const secret = data.secrets.find((s) => s._id=== secretId);
            if (!secret) {
            console.error('Secret not found');
            return;
            }
            console.log(secret.content);
            secret.fire =secret.fire+1;
            console.log(secret.fire);
            data.save().then(()=>{
                res.redirect("secrets");
            }).catch((err)=>{
                console.log(err);
            })
        }
    }
    catch(err)
    {
        console.log(err);
    }
  });
  


app.post('/sad', async(req, res) => {
    const secretId = req.body.secretId;
    // Find the secret by its ID
    try{
    var userID= req.user._id;
    if(!userID){
        userID=req.user;
    }
    }
    catch{
        res.redirect("secrets");
    }
   const data= await User.findOne({ 'secrets._id': secretId })
     try{
        if(data)
        {
            console.log(data);
            const secret = data.secrets.find((s) => s._id=== secretId);
            if (!secret) {
            console.error('Secret not found');
            return;
            }
            console.log(secret.content);
            secret.sad =secret.sad+1;
            console.log(secret.sad);
            data.save().then(()=>{
                res.redirect("secrets");
            }).catch((err)=>{
                console.log(err);
            })
        }
    }
    catch(err)
    {
        console.log(err);
    }
  });
  







app.listen(process.env.PORT || 3000,function()
{
    console.log("Server started at port 3000");
})
