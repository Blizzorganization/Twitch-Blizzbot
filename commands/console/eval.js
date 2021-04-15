const util = require("util");
const fs = require("fs");

exports.run = (clients, args) => {
    console.log(eval(args.join(" ")))
}