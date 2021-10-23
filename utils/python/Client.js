
const {PythonShell} =  require('python-shell') ;


const pythonConnect = async(PYPORT) => {
    try {
      let options = {
        mode: 'text',
        pythonOptions: ['-u'], // get print results in real-time
        scriptPath: 'utils/python',
        args: [PYPORT]
      };
      let pyshell = new PythonShell(`pyServer.py`,options);
      console.log(`PyServer started on port ${PYPORT}`)
      pyshell.on('error', function (stderr) {
        console.log(stderr)
        console.log('PyServer DISCONNECTED')
      });
      pyshell.on('message', function (message) {
        //console.log(message)
      });
    } catch (error) {
      
    }

  }


  module.exports = {pythonConnect}