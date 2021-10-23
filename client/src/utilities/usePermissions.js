import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux"
import { BUTTONS_PERMISSON, ADMIN_PERMISSON, DEV_PERMISSON } from "../constants/permissions";

const usePermissions = () => {
    const userState = useSelector((state) => state.user);
    const { permissions, permissionGroups } = userState;

    const [crudAccess, setcrudAccess] = useState(false);
    
    useEffect(() => {
        const access = permissionGroups.some(p => ADMIN_PERMISSON.grant.includes(p)) || permissions.some(p => BUTTONS_PERMISSON.grant.includes(p));
        setcrudAccess(access);
    }, [userState]);

    const checkPermission = useCallback((p) => {
        if (!p) return true;
        if (permissions.some(e=>p.deny.includes(e))) return false;
        return permissionGroups.some(p => ADMIN_PERMISSON.grant.includes(p)) || permissions.some(e => p.grant.includes(e))
    }, [userState])

    //specifically and only is they are a Developer
    const checkHasDevPermission = useCallback(() => {
        return permissionGroups.some(p => DEV_PERMISSON.grant.includes(p))
    }, [userState])

    return {
        crudAccess,
        checkPermission,
        checkHasDevPermission
    }
}

export default usePermissions