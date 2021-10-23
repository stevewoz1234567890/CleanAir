/* 
Since this is going in Cloudfront and not in Mongo, there
is not really the same schema/model process. Below are the
generic models that would be used

 */
const logLogin = (userID, userEmail, statusCode, message) => (
{
    event : 'Login',
    message,
    statusCode,
    userID,
    userEmail
});

const logUserLogout = (userID, userEmail, statusCode, message) => (
{
    event : 'User Logout',
    message,
    statusCode,
    userID,
    userEmail
});

const logPermissionChange = (userID, userEmail, statusCode, message, addedPermissions, removedPermissions) => (
{
    event : 'Permission Change',
    message,
    statusCode,
    addedPermissions, //Array Expected
    removedPermissions, //Array Expected
    userID,
    userEmail
});

const logGroupChange = (userID, userEmail, statusCode, message, addedGroups, removedGroups) => (
{
    event : 'Permission Group Change',
    message,
    statusCode,
    addedGroups, //Array Expected
    removedGroups, //Array Expected
    userID,
    userEmail
});

const logError = (userID, userEmail, statusCode, message) => (
    {
        event : 'Error',
        message,
        statusCode,
        userID,
        userEmail
    }
);

module.exports = {logLogin, logUserLogout, logPermissionChange, logGroupChange, logError};