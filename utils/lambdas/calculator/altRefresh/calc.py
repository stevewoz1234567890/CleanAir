import formulas as sys_formulas
from itertools import chain
import itertools
import numpy as np
import re
import json as sysjson
import sys

def lambda_handler(event, context):
    # print(event)
    response = getFormulaValue(event)
    
    ret = {
        "statusCode": 200,
        "body": response
    }
    print(sysjson.dumps(ret))


def getFormulaValue(event):
    try:
        #data = request.json
        inFormula = cleanFormula(event['formula'])
        formula = sys_formulas.Parser().ast(inFormula)[1].compile()
        inputs = list(formula.inputs)
        variables = cleanVariables(event['variables'])
        if "NULL" in inputs:
            variables['NULL'] = None

        response = formula(**variables)
        # print("response: ", response, type(response))
        cleanResp = parse_return_value(response)
        return {"value": cleanResp, "rawRes": str(response), "variables": variables}
    except Exception as e:
        return None
        # print("event: ", event)
        # print(e)

def cleanVariables(variables):
    newVars = {}
    for variable in variables:
        newVar = variable.replace(
            "[", '').replace("]", '').replace(" ", "_")
        newVars[newVar.upper()] = variables[variable]
    return newVars


def addDefaultVars(variables):
    pass
    variables['NULL'] = None


def cleanFormula(formula):
    regex = r"\[(.*?)\]"
    variables = list(set(re.findall(regex, formula)))
    formula = re.sub("\s\s+", " ", formula)
    formula = formula.lstrip()
    if formula[0] != "=":
        formula = "=" + formula

    for variable in variables:
        clean_var = variable.replace(
            "[", '').replace("]", '').replace(" ", "_")
        formula = formula.replace("[" + variable + "]", clean_var.upper())
    return formula

def parse_return_value(value=None):
    # print("value: ", value, type(value))
    if "#VALUE!" in str(value):
        return None
    if "#N/A" in str(value):
        return None
    
    if type(value) == sys_formulas.functions.Array: #there is some very weird and problematic but where this has to be moved up
        value = value.tolist()
        # print("new value: ", value, type(value))

        if isinstance(value, float):
            return value
        if isinstance(value, int):
            return value
        if isinstance(value, bool):
            return value
        if isinstance(value, list):
            # print("HIT")
            if len(value) == 1:
                new_list = list(itertools.chain(*value))[0]
                if isinstance(new_list, float):
                    return new_list
                if isinstance(new_list, int):
                    return new_list
                if isinstance(new_list, bool):
                    return new_list
                return new_list[0]

            return value    
    
    
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, bool):
        return value
    if ((value == "False") or (value == False)):
        return False
    if ((value == "True") or (value ==  True)):
        return True
    if isinstance(value, list):
        pass
        #print("LIST HIT")
    if type(value) == np.bool_:
        value = value.tolist()
        return value
    if type(value) == np.ndarray:
        value = value.tolist()
        new_list = list(itertools.chain(*value))
        # _json(new_list)
        return new_list

input = sysjson.loads(sys.argv[1])
lambda_handler(input,None)