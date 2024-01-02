import inquirer from 'inquirer';
import shell from 'shelljs';
import fs from 'fs';
import path from 'path';


const CONFIG_FILE = 'config.txt';

function readConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        return [];
    }
    return fs.readFileSync(CONFIG_FILE, 'utf8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            const match = line.match(/"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/);
            return match ? {
                path: match[1],
                command: match[2],
                name: match[3]
            } : null;
        })
        .filter(Boolean); // Filtra los nulos en caso de que haya líneas no válidas
}

function writeConfig(configs) {
    const data = configs.map(c => `"${c.path}" "${c.command}" "${c.name}"`).join('\n');
    fs.writeFileSync(CONFIG_FILE, data, 'utf8');
}

function openProject(project) {
    console.log(`Opening ${project.name} in ${project.path}`);
    shell.exec(project.command, { cwd: project.path });
}


function mainMenu() {
    const choices = readConfig().map(p => ({name: p.name, value: p}));

    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Choose an action:',
            choices: [...choices, new inquirer.Separator(), 'Add new project', 'Exit']
        }
    ]).then(answers => {
        if (answers.action === 'Add new project') {
            addProject();
        } else if (answers.action === 'Exit') {
            console.log('Exiting...');
        } else {
            openProject(answers.action);
        }
    });
}

function addProject() {
    inquirer.prompt([
        {
            type: 'input',
            name: 'path',
            message: 'Enter the project path:'
        },
        {
            type: 'input',
            name: 'command',
            message: 'Enter the command to run:'
        },
        {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this project:'
        },
        {
            type: 'confirm',
            name: 'confirmAdd',
            message: 'Are you sure you want to add this project?',
            default: false
        }
    ]).then(answers => {
        if (answers.confirmAdd) {
            const configs = readConfig();
            configs.push({path: answers.path, command: answers.command, name: answers.name});
            writeConfig(configs);
            console.log('Project added.');
        }
        mainMenu();
    });
}

mainMenu();
