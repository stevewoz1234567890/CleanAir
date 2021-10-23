
const { HyperFormula } = require('hyperformula') ;

class Formula{
    constructor(){
        this.options = {
            licenseKey: 'agpl-v3',
        }
        this.formula = HyperFormula.buildEmpty(this.options);
        this.expressions = [
            {
                name : 'value',
                value : null
            },
            {
                name : 'true',
                value : true
            },
            {
                name : 'false',
                value : false
            },
            {
                name : 'null',
                value : null
            },
            {
                name : 'formula',
                value: null
            }
        ]
        for(const exp of this.expressions){
            this.formula.addNamedExpression(exp.name, exp.value);
        }
        this.listOfExpressions = this.formula.listNamedExpressions();
    }
    addExpression(name,value){
        this.formula.addNamedExpression(name, value);
        this.expressions.push({name,value})
    }
    getFormulaValue(formula,variables){
        
        for(const variable of variables){
            const found = this.expressions.filter(row=>row.name == variable.name)
            if(found.length>0){
                this.formula.changeNamedExpression(variable.name, variable.value);
            }else{
                this.addExpression(variable.name, variable.value)
            }
        }
        this.formula.changeNamedExpression('formula', formula);
        const formulaValue = this.formula.getNamedExpressionValue('formula');

        return formulaValue
    }
}


module.exports = {Formula}