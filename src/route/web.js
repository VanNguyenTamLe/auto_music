// import express from "express";
const express = require('express');
// import homeController from "../controllers/homeController";
const homeController = require('../controllers/homeController');

let router = express.Router();

// Tất cả các route sẽ được viết ở đây
let initWebRoutes = (app) => {

    // Đang viết theo chuẩn res api
    router.get('/', homeController.getHomePage);


    // Đường dẫn trang chủ khi truy vập vào server
    return app.use("/", router);
}

module.exports = initWebRoutes;

