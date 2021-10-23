
import formulas as sys_formulas
from itertools import chain
import itertools
import numpy as np
import re
import json as sysjson


def json(data, indent=4):
    print(sysjson.dumps(data, indent=indent, default=str))


def getFormulaValue():
    true = True
    false = False
    null = None
    data = {
        "formula": "=IF(primary,SUM( {prifracs} * {nhvs} ),IF(secondary,SUM( {secfracs} * {nhvs} ), NULL))",
        "variables": {
            "primary": true,
            "secondary": null,
            "prifracs": [
                0.01,
                0.0015000000596046448,
                0.1306999969482422,
                -0.0007000000029802323,
                -0.00029100000858306885,
                0.7803646087646484,
                0.0064999997615814206,
                0.01,
                0.02869999885559082,
                0.02740000009536743,
                -0.005199990272521973,
                -0.0007999999821186065,
                7.629510760307312e-7,
                0.07
            ],
            "secfracs": None,
            "nhvs": [
                896,
                1595,
                0,
                0,
                0,
                1212,
                2150,
                2281,
                3655,
                2957,
                3655,
                2968,
                587,
                587
            ]
        },
        "unqiues": [
            "formula(5fbd80320aa1ec4824bfc1bc)",
            "formula(5fbd80320aa1ec4824bfc1ca)",
            "compoundGroup(5fc6db3d460ef84d37f33f42,fractional,primary)",
            "compoundGroup(5fc6db3d460ef84d37f33f42,fractional,secondary)",
            "compoundGroup(5fc6db3d460ef84d37f33f42,netHeatingValue)"
        ],
        "formulaName": "Header NHVvg",
        "formulaId": "5fbd80320aa1ec4824bfc1bd",
        "parentName": "LIU AROM",
        "parentid": "5fb6fd4cedcf06ae8256c74b"
    }

    inFormula = cleanFormula(data['formula'])
    print(inFormula)
    formula = sys_formulas.Parser().ast(inFormula)[1].compile()
    inputs = list(formula.inputs)
    print('inputs', inputs)
    variables = cleanVariables(data['variables'])
    # addDefaultVars(variables)
    if "NULL" in inputs:
        variables['NULL'] = None
    #print('variables', variables)
    json(variables)
    response = formula(**variables)
    print(response)
    cleanResp = parse_return_value(response)
    json({"formula": data['formula'], "value": cleanResp,
          "rawRes": str(response), "variables": variables})
    # return jsonify({"formula": data['formula'], "value": cleanResp})


def cleanVariables(variables):
    newVars = {}
    for variable in variables:
        newVar = variable.replace(
            "[", '').replace("]", '').replace(" ", "_")
        newVars[newVar.upper()] = variables[variable]
    # json(newVars)
    return newVars


def addDefaultVars(variables):
    return
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
    if "#VALUE!" in str(value):
        return None
    if "#N/A" in str(value):
        return None
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, bool):
        return value
    if isinstance(value, list):
        pass
        # print("LIST HIT")
    if type(value) == np.bool_:
        value = value.tolist()
        return value
    if type(value) == np.ndarray:
        value = value.tolist()
        new_list = list(itertools.chain(*value))
        # _json(new_list)
        return new_list
    if type(value) == sys_formulas.functions.Array:
        value = value.tolist()

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

                # print("HIT")
                # print(value)
                # print(new_list)
                # if(new_list[0]):
                #     return new_list[0]
                # else:
                #     return new_list
                # return new_list[0]
                # try:
                #     new_list = list(itertools.chain(*value))[0]
                #     return new_list[0]
                # except:
                #     pass
                #     # new_list

            return value

            # print(value)


getFormulaValue()
