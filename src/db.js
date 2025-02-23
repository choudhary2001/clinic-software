const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'billing.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database');
    }
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Complaint (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS PatientRecord (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        reg_no TEXT UNIQUE,
        case_no TEXT,
        name TEXT,
        guardian_name TEXT,
        age TEXT,
        gender TEXT,
        address TEXT,
        mobile_no TEXT,
        valid_upto TEXT,
        investigation TEXT,
        weight TEXT,
        fever TEXT,
        pulse TEXT,
        bp TEXT,
        spo2 TEXT,
        on_e TEXT,
        cvs TEXT,
        chest TEXT,
        cns TEXT,
        pa TEXT,
        from_date TEXT
    )`);

    db.run(`
        -- Create PatientComplaint Junction Table (if not exists)
        CREATE TABLE IF NOT EXISTS PatientComplaint (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            complaint_id INTEGER,
            FOREIGN KEY (patient_id) REFERENCES PatientRecord(id),
            FOREIGN KEY (complaint_id) REFERENCES Complaint(id)
        );
    `)

    db.run(`CREATE TABLE IF NOT EXISTS Service (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        price REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS InvoiceItem (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER,
        quantity INTEGER,
        line_total REAL,
        FOREIGN KEY(service_id) REFERENCES Service(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS Invoice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        item_ids TEXT, 
        date TEXT,
        total_amount REAL,
        status TEXT,
        FOREIGN KEY(patient_id) REFERENCES PatientRecord(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS  Invoice_item_relationship (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        item_id INTEGER,
        FOREIGN KEY (invoice_id) REFERENCES Invoice(id),
        FOREIGN KEY (item_id) REFERENCES InvoiceItem(id)
    )`);
});

// Complaint-related database operations
const getComplaints = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM Complaint', (err, rows) => {
            if (err) {
                console.error('Error fetching complaints:', err.message);
                reject(err);
            }
            resolve(rows);
        });
    });
};

const addComplaint = (complaint) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO Complaint (name) VALUES (?)',
            [complaint],
            function (err) {
                if (err) {
                    console.error('Error adding complaint:', err.message);
                    reject(err);
                }
                resolve({ id: this.lastID });
            }
        );
    });
};

const updateComplaint = (id, complaint) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE Complaint SET name = ? WHERE id = ?',
            [complaint, id],
            (err) => {
                if (err) {
                    console.error('Error updating complaint:', err.message);
                    reject(err);
                }
                resolve({ success: true });
            }
        );
    });
};

// Service-related database operations
const getServices = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM Service', (err, rows) => {
            if (err) {
                console.error('Error fetching Service:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const addService = (service, price) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO Service (name, price) VALUES (?, ?)',
            [service, price],
            function (err) {
                if (err) {
                    console.error('Error adding Service:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            }
        );
    });
};

const updateService = (id, service, price) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE Service SET name = ?, price = ? WHERE id = ?',
            [service, price, id],
            (err) => {
                if (err) {
                    console.error('Error updating Service:', err.message);
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
};

// Complaint-related database operations
const getPatients = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM PatientRecord ORDER BY DATE(date) DESC', (err, rows) => {
            if (err) {
                console.error('Error fetching Patients:', err.message);
                reject(err);
            }
            resolve(rows);
        });
    });
};

const getLatestPatient = () => {
    return new Promise((resolve, reject) => {
        // SQL query to calculate the latest case_no and reg_no
        const query = `
            SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN MAX(CASE WHEN case_no IS NOT NULL THEN CAST(case_no AS INT) END) + 1
                    ELSE 1
                END AS latest_case_no,
                CASE 
                    WHEN COUNT(*) > 0 THEN MAX(CASE WHEN reg_no IS NOT NULL THEN CAST(reg_no AS INT) END) + 1
                    ELSE 69998
                END AS latest_reg_no
            FROM PatientRecord;
        `;

        db.get(query, (err, row) => {
            if (err) {
                console.error('Error fetching latest patient:', err.message);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Generate reg_no (start from 69998)
const generateRegNo = () => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT MAX(CAST(reg_no AS INTEGER)) AS latest_reg_no FROM PatientRecord`, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            let latest_reg_no = row.latest_reg_no || 71115; // Default to 69997 if no records exist
            let next_reg_no = Math.max(71115, latest_reg_no + 1);
            resolve(next_reg_no);
        });
    });
};

// Generate case_no (start from 1 for each day)
const generateCaseNo = () => {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    return new Promise((resolve, reject) => {
        db.get(`SELECT MAX(CAST(case_no AS INTEGER)) AS latest_case_no FROM PatientRecord WHERE date = ?`, [today], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            let latest_case_no = row.latest_case_no || 0; // Default to 0 if no records exist for today
            let next_case_no = latest_case_no + 1;
            resolve(next_case_no);
        });
    });
};

// Function to save patient record and link complaints
const savePatientRecord = (formData, event) => {
    const {
        name,
        guardian_name,
        age,
        gender,
        mobile_no,
        address,
        complaints,
        weight,
        fever,
        pulse,
        bp,
        spo2,
        on_e,
        cvs,
        chest,
        cns,
        pa,
        investigation,
        from_date
    } = formData;


    // Generate both reg_no and case_no and save the patient record
    Promise.all([generateRegNo(), generateCaseNo()])
        .then(([nextRegNo, nextCaseNo]) => {
            const valid_upto_date = new Date();
            valid_upto_date.setDate(valid_upto_date.getDate() + 15);
            const valid_upto = valid_upto_date.toISOString().split('T')[0]; // Format as YYYY-MM-DD

            // Insert patient record into PatientRecord table
            db.run(`INSERT INTO PatientRecord 
                        (name, guardian_name, age, gender, mobile_no, address, weight, fever, pulse, bp, spo2, on_e, cvs, chest, cns, pa, investigation, from_date, valid_upto, reg_no, case_no, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, guardian_name, age, gender, mobile_no, address, weight, fever, pulse, bp, spo2, on_e, cvs, chest, cns, pa, investigation, from_date, valid_upto, nextRegNo, nextCaseNo, new Date().toISOString().split('T')[0]], function (err) {
                    if (err) {
                        console.error('Error saving patient record:', err.message);
                        event.sender.send('save-patient-error', err.message);
                        return;
                    }

                    const patientRecordId = this.lastID; // Get the inserted patient's ID

                    // Insert the complaints linked to this patient
                    complaints.forEach(complaintId => {
                        db.run(`INSERT INTO PatientComplaint (patient_id, complaint_id) VALUES (?, ?)`, [patientRecordId, complaintId], function (err) {
                            if (err) {
                                console.error('Error linking complaint:', err.message);
                                event.sender.send('save-patient-error', err.message);
                            }
                        });
                    });

                    // Send success response
                    // event.sender.send('save-patient-success', 'Patient record saved successfully!');
                    event.sender.send('save-patient-success', {
                        message: 'Patient record saved successfully!',
                        patient_id: patientRecordId
                    });
                });
        })
        .catch(err => {
            console.error('Error generating reg_no or case_no:', err.message);
            event.sender.send('save-patient-error', err.message);
        });
};

const deletePatientRecord = (id) => {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM PatientRecord WHERE id = ?',
            [id],
            (err) => {
                if (err) {
                    console.error('Error deleting Patient:', err.message);
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
};

const getComplaintsForPatient = (patientId, event) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT c.name, c.id
            FROM PatientComplaint pc
            JOIN Complaint c ON pc.complaint_id = c.id
            WHERE pc.patient_id = ?;
        `;

        db.all(sql, [patientId], (err, rows) => {
            if (err) {
                console.error('Error retrieving complaints:', err.message);
                reject(err);
            }
            // Resolve with the complaints data
            resolve(rows);
        });
    });
};

const updatePatientRecord = async (formData, event) => {
    console.log(formData);
    const {
        id,
        name,
        guardian_name,
        age,
        gender,
        mobile_no,
        address,
        complaints,
        weight,
        fever,
        pulse,
        bp,
        spo2,
        on_e,
        cvs,
        chest,
        cns,
        pa,
        investigation,
        from_date
    } = formData;

    try {
        // Generate both reg_no and case_no
        const [nextRegNo, nextCaseNo] = await Promise.all([generateRegNo(), generateCaseNo()]);

        const valid_upto_date = new Date();
        valid_upto_date.setDate(valid_upto_date.getDate() + 15);
        const valid_upto = valid_upto_date.toISOString().split('T')[0]; // Format as YYYY-MM-DD

        // Update the patient record in the database
        const updateQuery = `
            UPDATE PatientRecord
            SET name = ?, guardian_name = ?, age = ?, gender = ?, mobile_no = ?, address = ?, weight = ?, fever = ?, pulse = ?, bp = ?, spo2 = ?, on_e = ?, cvs = ?, chest = ?, cns = ?, pa = ?, investigation = ?, from_date = ?
            WHERE id = ?;
        `;

        const result = await db.run(updateQuery, [name, guardian_name, age, gender, mobile_no, address, weight, fever, pulse, bp, spo2, on_e, cvs, chest, cns, pa, investigation, from_date, id]);

        if (result.changes === 0) {
            throw new Error('Patient not found or no changes made.');
        }

        // If complaints are provided, update them in the PatientComplaint table
        if (complaints && complaints.length > 0) {
            // First, remove the existing complaints for the patient
            await db.run('DELETE FROM PatientComplaint WHERE patient_id = ?', [id]);

            // Then, insert the new complaints
            const insertComplaintsQuery = `
                INSERT INTO PatientComplaint (patient_id, complaint_id)
                VALUES (?, ?);
            `;
            for (let complaintId of complaints) {
                await db.run(insertComplaintsQuery, [id, complaintId]);
            }
        }

        // Return the updated patient data
        const updatedPatient = await db.get('SELECT * FROM PatientRecord WHERE id = ?', [id]);

        event.sender.send('update-patient-success', { success: true, data: updatedPatient });
    } catch (err) {
        console.error('Error updating patient:', err.message);
        event.sender.send('save-patient-error', err.message);
    }
};

// Utility function to get patient by reg_no
function getPatientByRegNo(reg_no) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM PatientRecord WHERE reg_no = ?", [reg_no], (err, row) => {
            if (err) return reject(err);
            resolve(row); // return patient record if found
        });
    });
}

// Utility function to get service by ID
function getServiceById(serviceId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM Service WHERE id = ?", [serviceId], (err, row) => {
            if (err) return reject(err);
            resolve(row); // return service details if found
        });
    });
}

// Function to create a new invoice
function createInvoice(patientId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO Invoice (patient_id, status, date) VALUES (?, ?, ?)");
        stmt.run(patientId, 'Pending', new Date().toISOString(), function (err) {
            if (err) return reject(err);
            resolve(this.lastID);  // Return the created invoice ID
        });
        stmt.finalize();
    });
}

// Function to add an InvoiceItem
function createInvoiceItem(serviceId, quantity, lineTotal) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO InvoiceItem (service_id, quantity, line_total) VALUES (?, ?, ?)");
        stmt.run(serviceId, quantity, lineTotal, function (err) {
            if (err) return reject(err);
            resolve(this.lastID);  // Return the created InvoiceItem ID
        });
        stmt.finalize();
    });
}

// Function to link an invoice item to an invoice
function linkInvoiceItemToInvoice(invoiceId, itemId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO Invoice_item_relationship (invoice_id, item_id) VALUES (?, ?)");
        stmt.run(invoiceId, itemId, function (err) {
            if (err) return reject(err);
            resolve();  // Return when the linking is done
        });
        stmt.finalize();
    });
}

// Function to update the total amount of an invoice
function updateInvoiceTotalAmount(invoiceId, totalAmount) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("UPDATE Invoice SET total_amount = ? WHERE id = ?");
        stmt.run(totalAmount, invoiceId, function (err) {
            if (err) return reject(err);
            resolve();  // Return when the total amount is updated
        });
        stmt.finalize();
    });
}

function getInvoicesFromDB(search = '', startDate = '', endDate = '', page = 1) {
    return new Promise((resolve, reject) => {
        const pageSize = 10; // Number of invoices per page
        const offset = (page - 1) * pageSize;

        // Main query to fetch invoices with details
        let query = `
            SELECT 
                Invoice.id, 
                Invoice.date, 
                Invoice.total_amount,
                PatientRecord.name AS patientName,
                PatientRecord.reg_no AS patientRegNo,
                PatientRecord.age AS patientAge,
                PatientRecord.gender AS patientGender,
                PatientRecord.address AS patientAddress,
                PatientRecord.mobile_no AS patientMobileNo,
                PatientRecord.guardian_name AS patientGuardianName,
                GROUP_CONCAT(Service.name || ':' || InvoiceItem.quantity || ':' || InvoiceItem.line_total || ':' || Service.price || ':' || Service.id) AS items
            FROM Invoice
            JOIN PatientRecord ON Invoice.patient_id = PatientRecord.id
            JOIN Invoice_item_relationship ON Invoice.id = Invoice_item_relationship.invoice_id
            JOIN InvoiceItem ON Invoice_item_relationship.item_id = InvoiceItem.id
            JOIN Service ON InvoiceItem.service_id = Service.id
            WHERE 1 = 1
        `;

        const params = [];

        // Add search filter
        if (search) {
            query += ` AND PatientRecord.name LIKE ?`;
            params.push(`%${search}%`);
        }

        // Add date range filter
        if (startDate) {
            query += ` AND Invoice.date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND Invoice.date <= ?`;
            params.push(endDate);
        }

        // Pagination
        query += ` GROUP BY Invoice.id LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        // Count query to fetch the total number of invoices
        let countQuery = `
            SELECT COUNT(DISTINCT Invoice.id) AS count
            FROM Invoice
            JOIN PatientRecord ON Invoice.patient_id = PatientRecord.id
            WHERE 1 = 1
        `;

        const countParams = [];

        // Add the same filters for the count query
        if (search) {
            countQuery += ` AND PatientRecord.name LIKE ?`;
            countParams.push(`%${search}%`);
        }
        if (startDate) {
            countQuery += ` AND Invoice.date >= ?`;
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ` AND Invoice.date <= ?`;
            countParams.push(endDate);
        }

        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            // Map the rows to structured invoice data
            const invoices = rows.map(row => ({
                id: row.id,
                date: row.date,
                totalAmount: row.total_amount,
                patientName: row.patientName,
                patientAge: row.patientAge,
                patientGender: row.patientGender,
                patientRegNo: row.patientRegNo,
                patientGuardianName: row.patientGuardianName,
                patientMobileNo: row.patientMobileNo,
                patientAddress: row.patientAddress,
                items: row.items ? row.items.split(',').map(item => {
                    const [serviceName, quantity, lineTotal, price, serviceId] = item.split(':');
                    return { serviceName, quantity: parseInt(quantity, 10), lineTotal: parseFloat(lineTotal), servicePrice: price, serviceId: serviceId };
                }) : [],
            }));

            // Execute the count query
            db.get(countQuery, countParams, (err, countRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                const totalPages = Math.ceil(countRow.count / pageSize);
                const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);

                resolve({ invoices, totalAmount, totalPages });
            });
        });
    });
}

// Utility function to get invoice by ID
function getInvoiceById(invoiceId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM Invoice WHERE id = ?", [invoiceId], (err, row) => {
            if (err) return reject(err);
            resolve(row); // Return invoice record if found
        });
    });
}

// Function to clear existing items for an invoice
function clearInvoiceItems(invoiceId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("DELETE FROM Invoice_item_relationship WHERE invoice_id = ?");
        stmt.run(invoiceId, function (err) {
            if (err) return reject(err);
            resolve();  // Return when the items are deleted
        });
        stmt.finalize();
    });
}


module.exports = {
    db,
    getComplaints,
    addComplaint,
    updateComplaint,
    getServices,
    addService,
    updateService,
    getPatients,
    getLatestPatient,
    savePatientRecord,
    generateRegNo,
    generateCaseNo,
    deletePatientRecord,
    getComplaintsForPatient,
    updatePatientRecord,
    getPatientByRegNo,
    getServiceById,
    createInvoice,
    createInvoiceItem,
    linkInvoiceItemToInvoice,
    updateInvoiceTotalAmount,
    getInvoicesFromDB,
    getInvoiceById,
    clearInvoiceItems
};
