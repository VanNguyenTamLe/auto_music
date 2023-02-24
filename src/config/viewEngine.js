//import express library
// import express from "express";
const express = require('express');

let configViewEngine = (app) => {
    // cấu hình cho ứng dụng cho phép người dùng truy cập file nào
    app.use(express.static("./src/public"))

    // cấu hình cho ứng dụng sử dụng được ejs file view
    app.set("view engine", "ejs");

    // cấu hình đường link dẫn đến thư mục view
    app.set("views", "./src/views");
}

// export function để nơi khác sử dụng
module.exports = configViewEngine;