// test-server.js
console.log('TEST: Starting server test');

process.on('uncaughtException', (e) => {
  console.log('TEST: UNCAUGHT EXCEPTION:', e.message);
  console.log(e.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('TEST: UNHANDLED REJECTION:', reason);
  process.exit(1);
});

setTimeout(() => {
  console.log('TEST: Timeout - server not started after 5 seconds');
  process.exit(0);
}, 5000);

console.log('TEST: About to require server');
try {
  require('./server');
  console.log('TEST: Server required successfully');
} catch (e) {
  console.log('TEST: Error requiring server:', e.message);
  process.exit(1);
}
