import inquirer from 'inquirer';
import shell from 'shelljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_FILE = path.join(__dirname, 'config.txt');
const COMMANDS_FILE = path.join(__dirname, 'commands.txt');

function createFileIfNotExists(filePath, defaultContent = '') {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, defaultContent, 'utf8');
    }
}

function readFileLines(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return fs.readFileSync(filePath, 'utf8').split('\n').filter(line => line.trim() !== '');
}

function parseConfigLine(line) {
    const match = line.match(/"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/);
    return match ? { path: match[1], command: match[2], name: match[3] } : null;
}

function parseCategoryLine(line) {
    const match = line.match(/"([^"]+)"\s+"([^"]+)"/);
    return match ? { path: match[1], name: match[2] } : null;
}

function writeFileLines(filePath, lines) {
    try {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    } catch (error) {
        console.error('Error al escribir en el archivo:', error);
        returnToMainMenu();
    }
}


function readCategories() {
    const categoryFiles = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.categorias.txt'))
        .map(file => path.join(__dirname, file));

    const categories = categoryFiles.reduce((categories, file) => {
        const categoryName = path.basename(file, '.categorias.txt');
        const items = readFileLines(file).map(parseCategoryLine).filter(Boolean);

        categories[categoryName] = items;
        return categories;
    }, {});


    return categories;
}




function readConfig() {
    return readFileLines(CONFIG_FILE).map(parseConfigLine).filter(Boolean).map(project => {
        return { ...project, lastModified: getLastModifiedTime(project.path) };
    });
}


function writeConfig(configs) {
    const lines = configs.map(c => `"${c.path}" "${c.command}" "${c.name}"`);
    writeFileLines(CONFIG_FILE, lines);
}

function openProject(project) {

    shell.exec(project.command, { cwd: project.path }, () => {

    });
}


function deleteProject() {
    const projects = readConfig();
    inquirer.prompt([
        {
            type: 'list',
            name: 'projectToDelete',
            message: 'Selecciona un proyecto para eliminar:',
            choices: projects.map(p => ({ name: p.name, value: p }))
        }
    ]).then(answer => {
        const updatedProjects = projects.filter(p => p !== answer.projectToDelete);
        writeConfig(updatedProjects);

        returnToMainMenu();
    });
}

function moveProject() {
    const projects = readConfig();
    inquirer.prompt([
        {
            type: 'list',
            name: 'projectToMove',
            message: 'Select a project to move:',
            choices: projects.map(p => ({ name: p.name, value: p }))
        },
        {
            type: 'list',
            name: 'newPosition',
            message: 'New position for the project:',
            choices: projects.map((p, index) => ({ name: `Position ${index + 1}`, value: index }))
        }
    ]).then(answer => {
        const { projectToMove, newPosition } = answer;
        const filteredProjects = projects.filter(p => p !== projectToMove);
        filteredProjects.splice(newPosition, 0, projectToMove);
        writeConfig(filteredProjects);

        returnToMainMenu();
    });
}

function addProject() {
    const commands = readCommandsConfig();
    inquirer.prompt([
        {
            type: 'input',
            name: 'path',
            message: 'Ingresa la ruta del proyecto (o "." para el directorio actual):'
        },
        {
            type: 'list',
            name: 'command',
            message: 'Selecciona un comando para ejecutar:',
            choices: commands.map(cmd => ({ name: cmd.name, value: cmd.command })),
            default: commands.length > 0 ? commands[0].command : ''
        },
        {
            type: 'input',
            name: 'name',
            message: 'Ingresa un nombre para este proyecto:'
        }
    ]).then(answers => {
        const selectedCommand = commands.find(cmd => cmd.command === answers.command);
        const projectName = selectedCommand ? `${answers.name} | ${selectedCommand.identifier}` : answers.name;
        const projectPath = answers.path === '.' ? process.cwd() : answers.path;
        const configs = readConfig();
        configs.push({ path: projectPath, command: answers.command, name: projectName });
        writeConfig(configs);

        returnToMainMenu();
    });
}
function addCommand() {
    inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Ingresa un nombre para el comando:'
        },
        {
            type: 'input',
            name: 'command',
            message: 'Ingresa el comando a ejecutar:'
        },
        {
            type: 'input',
            name: 'identifier',
            message: 'Ingresa un identificador para el comando (opcional):'
        }
    ]).then(answers => {
        const commands = readCommandsConfig();
        commands.push({ name: answers.name, command: answers.command, identifier: answers.identifier });
        writeCommandsConfig(commands);

        returnToMainMenu();
    });
}
function mainMenu() {
    const categories = readCategories();
    const categoryChoices = Object.keys(categories).map(cat => `- ${cat}`);

    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Elige una opción:',
            pageSize: 20,
            pageSize: 20,
            pageSize: 20,
            choices: [

                new inquirer.Separator(''),
                'Abrir un proyecto',
                'Crear archivo',
                new inquirer.Separator(''),
                ...categoryChoices,
                new inquirer.Separator(''),
                'Gestionar Proyectos',
                'Gestionar Categorías',
                'Gestionar Comandos',
                'Salir'
            ]
        }
    ]).then(answer => {
        if (answer.action === 'Crear archivo') {
            createFileMenu();
        } else if (answer.action === 'Abrir un proyecto') {
            openProjectMenu();
        } else if (answer.action.startsWith('- ')) {
            console.log('--------------');

            manageCategory(answer.action.replace('- ', ''));
        } else {
            switch (answer.action) {
                case 'Gestionar Proyectos':
                    projectsMenu();
                    break;
                case 'Gestionar Categorías':
                    categoriesMenu();
                    break;
                case 'Gestionar Comandos':
                    commandsMenu();
                    break;
                case 'Salir':

                    break;
            }
        }
    });
}



function projectsMenu() {
    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Gestionar Proyectos:',
            pageSize: 20,
            pageSize: 20,
            choices: [

                'Abrir un proyecto',
                'Agregar nuevo proyecto',
                'Eliminar un proyecto',
                'Mover un proyecto',
                'Volver al menú principal'
            ]
        }
    ]).then(answer => {
        switch (answer.action) {
            case 'Abrir un proyecto':
                openProjectMenu();
                break;
            case 'Agregar nuevo proyecto':
                addProject();
                break;
            case 'Eliminar un proyecto':
                deleteProject();
                break;
            case 'Mover un proyecto':
                moveProject();
                break;
            case 'Volver al menú principal':
                mainMenu();
                break;
        }
    });
}

function categoriesMenu() {
    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Gestionar Categorías:',
            pageSize: 20,
            choices: [

                'Listar y gestionar categorías',
                'Agregar nueva categoría',
                'Volver al menú principal'
            ]
        }
    ]).then(answer => {
        switch (answer.action) {
            case 'Listar y gestionar categorías':
                listCategoriesMenu();
                break;
            case 'Agregar nueva categoría':
                addCategory();
                break;
            case 'Volver al menú principal':
                mainMenu();
                break;
        }
    });
}
function listCategoriesMenu() {
    const categories = readCategories();
    const categoryChoices = Object.keys(categories).map(cat => cat);

    inquirer.prompt([
        {
            type: 'list',
            name: 'selectedCategory',
            message: 'Elige una categoría para gestionar:',
            pageSize: 20,
            choices: [...categoryChoices, 'Volver al menú de categorías']
        }
    ]).then(answer => {
        if (answer.selectedCategory === 'Volver al menú de categorías') {
            categoriesMenu();
        } else {
            manageCategory(answer.selectedCategory);
        }
    });
}




function manageCategory(categoryName) {
    const categories = readCategories();
    const items = categories[categoryName];

    if (!items || items.length === 0) {

        returnToMainMenu();
        return;
    }

    inquirer.prompt([
        {
            type: 'list',
            name: 'selectedItem',
            message: `Elige un elemento de la categoría '${categoryName}':`,
            choices: items.map(item => item.name).concat(['Volver al menú principal'])
        }
    ]).then(answer => {
        if (answer.selectedItem === 'Volver al menú principal') {
            mainMenu();
        } else {
            const selectedItem = items.find(item => item.name === answer.selectedItem);
            selectCategoryItemAction(selectedItem, categoryName);
        }
    });
}



function selectCategoryItemAction(selectedItem, categoryName) {

    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: `Elige una acción para '${selectedItem.name}':`,
            choices: ['Ejecutar', 'Abrir carpeta', 'Volver']
        }
    ]).then(answer => {
        switch (answer.action) {
            case 'Ejecutar':
                exec(`start "" "${selectedItem.path}"`, (error) => {
                    if (error) {
                        console.error('Error al abrir el archivo:', error);
                    }
                    watchFile(selectedItem.path);
                    manageCategory(categoryName); // Volver a la gestión de la categoría
                });

                break;
            case 'Abrir carpeta':
                const folderPath = path.dirname(selectedItem.path);
                exec(`start "" "${folderPath}"`, (error) => {
                    if (error) {
                        console.error('Error al abrir la carpeta:', error);
                    }
                    manageCategory(categoryName); // Volver a la gestión de la categoría
                });
                break;
            case 'Volver':
                manageCategory(categoryName);
                break;
        }
    });
}



function commandsMenu() {
    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Gestionar Comandos:',
            choices: [
                'Agregar nuevo comando',
                'Volver al menú principal'
            ]
        }
    ]).then(answer => {
        switch (answer.action) {
            case 'Agregar nuevo comando':
                addCommand();
                break;
            case 'Volver al menú principal':
                mainMenu();
                break;
        }
    });
}

function chooseCategory(actionFunction) {
    const categories = readCategories();
    inquirer.prompt([
        {
            type: 'list',
            name: 'categoryName',
            message: 'Elige una categoría:',
            choices: Object.keys(categories)
        }
    ]).then(answer => {
        actionFunction(answer.categoryName);
    });
}



function getMaxLength(items, key) {
    return items.reduce((max, item) => Math.max(max, item[key].length), 0);
}

function padRight(text, length) {
    return text + ' '.repeat(length - text.length);
}

function openProjectMenu() {
    const projects = readConfig();
    const sortedProjects = projects.sort((a, b) => b.lastModified - a.lastModified); // Orden descendente

    // Calcula la longitud máxima del nombre de los proyectos
    const maxLength = getMaxLength(sortedProjects, 'name');

    // Rellena los nombres de los proyectos
    const paddedProjects = sortedProjects.map(project => {
        return {
            ...project,
            paddedName: padRight(project.name, maxLength)
        };
    });

    inquirer.prompt([
        {
            type: 'checkbox',
            name: 'projects',
            message: 'Selecciona los proyectos a abrir:',
            pageSize: 40,
            choices: paddedProjects.map(p => ({
                name: ` ${p.paddedName} (${timeSince(p.lastModified)})`,
                value: p
            }))
        }
    ]).then(answers => {
        const selectedProjects = answers.projects;

        if (selectedProjects.length > 0) {
            inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Elige una acción para los proyectos seleccionados:',
                    choices: [
                        { name: 'Ejecutar acción', value: 'exec-action' },
                        { name: 'Abrir carpetas de los proyectos', value: 'openFolders' }
                    ]
                }
            ]).then(actionAnswer => {
                if (actionAnswer.action === 'exec-action') {
                    selectedProjects.forEach(project => {
                        openProject(project);
                    });
                    returnToMainMenu();
                } else
                    if (actionAnswer.action === 'openFolders') {
                        selectedProjects.forEach(project => {
                            const folderPath = path.resolve(project.path); // Asegúrate de que la ruta sea absoluta
                            exec(`start "" "${folderPath}"`); // Usa el comando 'start' para abrir la carpeta
                        });
                        returnToMainMenu();
                    }
            });
        } else {

            returnToMainMenu();
        }
    });
}


function returnToMainMenu() {
    inquirer.prompt([
        {
            type: 'confirm',
            name: 'return',
            message: 'Regresar al menú principal?',
            default: true
        }
    ]).then(answer => {
        if (answer.return) {
            mainMenu();
        }
    });
}

function readCommandsConfig() {
    if (!fs.existsSync(COMMANDS_FILE)) {
        return [];
    }
    return fs.readFileSync(COMMANDS_FILE, 'utf8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            const match = line.match(/"([^"]+)"\s+"([^"]+)"\s*("([^"]+)")?/);
            return match ? {
                name: match[1],
                command: match[2],
                identifier: match[4] || ''
            } : null;
        })
        .filter(Boolean);
}

function writeCommandsConfig(commands) {
    const lines = commands.map(c => `"${c.name}" "${c.command}" ${c.identifier ? `"${c.identifier}"` : ''}`);
    writeFileLines(COMMANDS_FILE, lines);
}

function openCategoryMenu(categoryName) {
    const categories = readCategories();
    const categoryItems = categories[categoryName];

    inquirer.prompt([
        {
            type: 'list',
            name: 'selectedItem',
            message: `Elige un elemento de la categoría '${categoryName}':`,
            choices: categoryItems.map(item => item.name)
        },
        {
            type: 'list',
            name: 'action',
            message: 'Elige una acción:',
            choices: ['Ejecutar', 'Abrir carpeta']
        }
    ]).then(answer => {
        const selectedItem = categoryItems.find(item => item.name === answer.selectedItem);
        if (answer.action === 'Ejecutar') {
            exec(`start "" "${selectedItem.path}"`);
        } else {
            const folderPath = path.dirname(selectedItem.path);
            exec(`start "" "${folderPath}"`);
        }
    });
}

// Función para agregar un elemento a una categoría
function addCategoryItem(categoryName) {
    inquirer.prompt([
        {
            type: 'input',
            name: 'path',
            message: 'Ingresa la ruta del elemento:'
        },
        {
            type: 'input',
            name: 'name',
            message: 'Ingresa un nombre para este elemento:'
        }
    ]).then(answers => {
        const categoryFile = path.join(__dirname, `${categoryName}.categorias.txt`);
        const newItem = `"${answers.path}" "${answers.name}"\n`;
        fs.appendFileSync(categoryFile, newItem, 'utf8');

        returnToMainMenu();
    });
}

function writeCategoryFile(categoryName, items) {
    const categoryFile = path.join(__dirname, `${categoryName}.categorias.txt`);
    const lines = items.map(item => `"${item.path}" "${item.name}"`);
    writeFileLines(categoryFile, lines);
}

function deleteCategoryItem(categoryName) {
    const categories = readCategories();
    const items = categories[categoryName];
    inquirer.prompt([
        {
            type: 'list',
            name: 'itemToDelete',
            message: 'Selecciona un elemento para eliminar:',
            choices: items.map(item => item.name)
        }
    ]).then(answer => {
        const updatedItems = items.filter(item => item.name !== answer.itemToDelete);
        writeCategoryFile(categoryName, updatedItems);

        returnToMainMenu();
    });
}

function moveCategoryItem(categoryName) {
    const categories = readCategories();
    const items = categories[categoryName];
    inquirer.prompt([
        {
            type: 'list',
            name: 'itemToMove',
            message: 'Selecciona un elemento para mover:',
            choices: items.map(item => item.name)
        },
        {
            type: 'list',
            name: 'newPosition',
            message: 'Nueva posición para el elemento:',
            choices: items.map((item, index) => ({ name: `Posición ${index + 1}`, value: index }))
        }
    ]).then(answer => {
        const { itemToMove, newPosition } = answer;
        const filteredItems = items.filter(item => item.name !== itemToMove);
        filteredItems.splice(newPosition, 0, items.find(item => item.name === itemToMove));
        writeCategoryFile(categoryName, filteredItems);

        returnToMainMenu();
    });
}

function getLastModifiedTime(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.mtime;
    } catch (error) {
        console.error('Error al obtener la fecha de modificación:', error);
        return new Date(0); // Retorna una fecha antigua si hay error
    }
}

function timeSince(date) {
    const now = new Date();
    const diff = now - date; // Diferencia en milisegundos

    let remaining = diff / 1000; // Convertir a segundos
    const seconds = Math.floor(remaining % 60);
    remaining /= 60; // Convertir a minutos
    const minutes = Math.floor(remaining % 60);
    remaining /= 60; // Convertir a horas
    const hours = Math.floor(remaining % 24);
    remaining /= 24; // Convertir a días
    const days = Math.floor(remaining % 30);
    const months = Math.floor(remaining / 30 % 12);
    const years = Math.floor(remaining / 365);

    let result = '';
    if (years > 0) result += `${years} año(s) `;
    if (months > 0) result += `${months} mes(es) `;
    if (days > 0) result += `${days} día(s) `;
    if (hours > 0) result += `${hours} hora(s) `;
    if (minutes > 0) result += `${minutes} min`;
    if (seconds > 0) result += `${seconds} seg`;

    return result.trim();
}

// ... código existente ...

function createFileMenu() {
    inquirer.prompt([
        {
            type: 'input',
            name: 'fileName',
            message: 'Ingresa el nombre del archivo:'
        }
    ]).then(answer => {
        const fileName = answer.fileName;
        chooseCategoryOrCreateNew(categoryName => {

            createFileInCategory(fileName, categoryName);
        });
    });
}

function chooseCategoryOrCreateNew(callback) {
    const categories = readCategories();
    inquirer.prompt([
        {
            type: 'list',
            name: 'categoryName',
            message: 'Elige una categoría o crea una nueva:',
            choices: [...Object.keys(categories), 'Crear nueva categoría']
        }
    ]).then(answer => {

        if (answer.categoryName === 'Crear nueva categoría') {
            addCategory(() => {
                chooseCategoryOrCreateNew(callback);
            });
        } else {
            callback(answer.categoryName);
        }
    });
}
function createFileInCategory(fileName, categoryName) {
    const categoryPath = path.join(__dirname, categoryName);
    const filePath = path.join(categoryPath, fileName);

    // Crear directorio si no existe
    if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath);
    }

    // Crear el archivo
    fs.writeFileSync(filePath, '', 'utf8');

    // Añadir entrada al archivo de categoría
    const categoryFile = path.join(__dirname, `${categoryName}.categorias.txt`);
    const newItem = `"${filePath}" "${fileName}"\n`;
    try {
        fs.appendFileSync(categoryFile, newItem, 'utf8');

    } catch (error) {
        console.error('Error al escribir en el archivo de categoría:', error);
    }

    // Opciones después de crear el archivo
    postCreateFileOptions(filePath);
}


function postCreateFileOptions(filePath) {
    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: '¿Qué deseas hacer ahora?',
            choices: [
                'Abrir archivo',
                'Crear otro archivo',
                'Volver al menú anterior'
            ]
        }
    ]).then(answer => {
        switch (answer.action) {
            case 'Abrir archivo':
                console.log('Abriendo archivo...');
                openFile(filePath);
                break;
            case 'Crear otro archivo':
                createFileMenu();
                break;
            case 'Volver al menú anterior':
                mainMenu();
                break;
        }
    });
}

function openFile(filePath) {
    let command;




    switch (os.platform()) {
        case 'win32':
            command = `start "" "${filePath}"`;
            break;
        case 'darwin':
            command = `open "${filePath}"`;
            break;
        case 'linux':
            command = `xdg-open "${filePath}"`;
            break;
        default:
            console.error('Plataforma no soportada para abrir archivos');
            return;
    }
    exec(command, (error) => {
        if (error) {
            console.error('Error al abrir el archivo:', error);
        } else {
            watchFile(filePath);
        }
    });
}


function addCategory(callback) {
    inquirer.prompt([
        {
            type: 'input',
            name: 'categoryName',
            message: 'Ingresa un nombre para la nueva categoría:'
        }
    ]).then(answer => {
        const categoryFile = path.join(__dirname, `${answer.categoryName}.categorias.txt`);
        createFileIfNotExists(categoryFile);
        if (typeof callback === 'function') {
            callback(); // Llamar al callback si es una función
        }
    });
}
function watchFile(filePath) {
    fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            console.log(`Cambio detectado en el archivo: ${filePath}`);
            gitCommitChanges(path.dirname(filePath), path.basename(filePath));
        }
    });
}
function watchDirectory(directoryPath) {
    fs.watch(directoryPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
            console.log(`Cambio detectado en el directorio: ${filename}`);
            gitCommitChanges(directoryPath, filename);
        }
    });
}

function gitCommitChanges(directoryPath, filename) {
    const commitMessage = `Commit automático: Cambios en ${filename}`;
    console.log(`Iniciando commit para los cambios en: ${filename}`);

    exec(`git add .`, { cwd: directoryPath }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al ejecutar git add: ${error.message}`);
            return;
        }
        exec(`git commit -m "${commitMessage}"`, { cwd: directoryPath }, (error, stdout, stderr) => {
            if (error) {
                if (error.message.includes('nothing to commit')) {
                    console.log('No hay cambios para hacer commit.');
                } else {
                    console.error(`Error al ejecutar git commit: ${error.message}`);
                }
            } else {
                console.log(`Commit realizado exitosamente para: ${filename}`);
            }
        });
    });
}

mainMenu();
