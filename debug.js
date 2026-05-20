window.addEventListener('error', function(event) {
    document.getElementById('debug').innerHTML += '<br/>'+event.message;
});
window.addEventListener('unhandledrejection', function(event) {
    document.getElementById('debug').innerHTML += '<br/>Promise rejected: '+event.reason;
});
