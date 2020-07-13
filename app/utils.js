exports.removeExtensionFromFile = (file) => {
    return file.split('.').slice(0, -1).join('.').toString()
}

exports.randomInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}