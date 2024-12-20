const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
let win;

const db = require('./db.js'); // Replace with the correct path


function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'), // Ensure the correct path
            nodeIntegration: true
        }
    });

    const isLoggedIn = fs.existsSync(path.join(__dirname, 'session.json'));

    if (isLoggedIn) {
        win.loadFile('src/index.html');  // Redirect to index page
    } else {
        win.loadFile('src/login.html');  // Stay on the login page
    }
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Dummy login credentials
const validCredentials = {
    email: "user@example.com",
    password: "password123"
};

ipcMain.handle('login', (event, credentials) => {
    const { email, password } = credentials;

    if (email === validCredentials.email && password === validCredentials.password) {
        // Save session data (e.g., user data)
        const sessionData = { email };
        fs.writeFileSync(path.join(__dirname, 'session.json'), JSON.stringify(sessionData));

        return { success: true }; // Login successful
    } else {
        return { success: false, message: "Invalid email or password." }; // Error
    }
});


ipcMain.handle('fetch-complaints', async () => {
    return await db.getComplaints();
});

ipcMain.handle('add-complaint', async (event, complaint) => {
    return await db.addComplaint(complaint);
});

ipcMain.handle('edit-complaint', async (event, id, complaint) => {
    return await db.updateComplaint(id, complaint);
});


ipcMain.handle('get-services', async () => {
    return await db.getServices();
});

ipcMain.handle('add-service', async (event, name, price) => {
    return await db.addService(name, price);
});

ipcMain.handle('update-service', async (event, id, name, price) => {
    return await db.updateService(id, name, price);
});


ipcMain.handle('get-latest-patieents', async () => {
    return await db.getLatestPatient();
});

ipcMain.handle('get-latest-case-no', async () => {
    return await db.generateCaseNo();
});

ipcMain.handle('get-latest-reg-no', async () => {
    return await db.generateRegNo();
});

ipcMain.on('save-patient-record', async (event, formData) => {
    return await db.savePatientRecord(formData, event);
});

ipcMain.handle('get-all-patients', async () => {
    return await db.getPatients();
});

ipcMain.handle('delete-service', async (event, id, name, price) => {
    return await db.updateService(id, name, price);
});

ipcMain.handle('delete-patient', async (event, id) => {
    return await db.deletePatientRecord(id);
});

ipcMain.handle('get-complaints', async (event, patientId) => {
    return await db.getComplaintsForPatient(patientId, event);
});

// Update patient record
ipcMain.handle('update-patient', async (event, formData) => {
    return await db.updatePatientRecord(formData, event);

});


// Handle service order creation
ipcMain.handle('create-service-order', async (event, services, reg_no) => {
    try {

        let totalOrderPrice = 0;

        // Retrieve patient based on reg_no
        const patient = await db.getPatientByRegNo(reg_no);
        if (!patient) {
            return { error: `Patient with reg_no ${reg_no} not found.` };
        }

        // Create the invoice first
        const invoiceId = await db.createInvoice(patient.id);

        // Loop through each service item
        const itemIds = [];
        for (const item of services) {
            console.log(item);
            const { service, quantity } = item;

            // Fetch the service details
            const serviceDetails = await db.getServiceById(service);
            if (!serviceDetails) {
                return { error: `Service with ID ${service} does not exist.` };
            }

            // Calculate the price and create the InvoiceItem
            const lineTotal = serviceDetails.price * quantity;
            totalOrderPrice += lineTotal;

            const itemId = await db.createInvoiceItem(service, quantity, lineTotal);
            itemIds.push(itemId);

            // Link InvoiceItem to Invoice in Invoice_item_relationship table
            await db.linkInvoiceItemToInvoice(invoiceId, itemId);
        }

        // Update the invoice with the total amount
        await db.updateInvoiceTotalAmount(invoiceId, totalOrderPrice);

        // Return the total order price
        return {
            message: "Services added successfully!",
            total_order_price: totalOrderPrice
        };

    } catch (error) {
        console.error("Error creating service order:", error);
        return { error: "An error occurred while processing the service order." };
    }
});

// Handle service order update
ipcMain.handle('update-service-order', async (event, services, reg_no, invoiceId) => {
    try {
        let totalOrderPrice = 0;

        // Retrieve patient based on reg_no
        const patient = await db.getPatientByRegNo(reg_no);
        if (!patient) {
            return { error: `Patient with reg_no ${reg_no} not found.` };
        }

        // Retrieve existing invoice
        const existingInvoice = await db.getInvoiceById(invoiceId);
        if (!existingInvoice) {
            return { error: `Invoice with ID ${invoiceId} does not exist.` };
        }

        // Clear existing invoice items
        await db.clearInvoiceItems(invoiceId);

        // Loop through each service item
        const itemIds = [];
        for (const item of services) {
            const { service, quantity } = item;

            // Fetch the service details
            const serviceDetails = await db.getServiceById(service);
            if (!serviceDetails) {
                return { error: `Service with ID ${service} does not exist.` };
            }

            // Calculate the price and create the InvoiceItem
            const lineTotal = serviceDetails.price * quantity;
            totalOrderPrice += lineTotal;

            const itemId = await db.createInvoiceItem(service, quantity, lineTotal);
            itemIds.push(itemId);

            // Link InvoiceItem to Invoice in Invoice_item_relationship table
            await db.linkInvoiceItemToInvoice(invoiceId, itemId);
        }

        // Update the invoice with the total amount
        await db.updateInvoiceTotalAmount(invoiceId, totalOrderPrice);

        // Return the total order price
        return {
            message: "Services updated successfully!",
            total_order_price: totalOrderPrice
        };

    } catch (error) {
        console.error("Error updating service order:", error);
        return { error: "An error occurred while updating the service order." };
    }
});


ipcMain.handle('get-invoices', async (event, query) => {
    try {
        console.log(query);
        const { search = '', startDate = '', endDate = '', page = 1 } = query;

        // Call the database function to get invoices
        const { invoices, totalAmount, totalPages } = await db.getInvoicesFromDB(search, startDate, endDate, page);

        // Return the response
        return { invoices, totalAmount, totalPages, currentPage: page };
    } catch (error) {
        console.error('Error fetching invoices:', error);
        throw new Error('Could not fetch invoices');
    }
});

ipcMain.handle('logout', () => {
    const sessionFilePath = path.join(__dirname, 'session.json');

    // Delete session data (logout)
    if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
    }

    // Reload the login page after logout
    win.loadFile('src/login.html');
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
