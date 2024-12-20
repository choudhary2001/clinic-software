const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, callback) => ipcRenderer.on(channel, callback),
});

function formatDateTime(isoDate) {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}


document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logout_button = document.getElementById('logout_button');
    const errorMessage = document.getElementById('error-message');
    const complaintInput = document.getElementById('complaintInput');
    const addComplaintBtn = document.getElementById('addComplaintBtn');
    const complaintList = document.getElementById('complaintList');
    const complaintModal = document.getElementById("complaintModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const complaintForm = document.getElementById("complaintForm");
    const modalTitle = document.getElementById("modalTitle");
    const complaintDescriptionInput = document.getElementById("complaintDescription");
    const searchInput = document.getElementById("searchInput");

    let isEdit = false;
    let editComplaintId = null;

    // Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!email || !password) {
                errorMessage.textContent = 'Email and Password are required.';
                errorMessage.classList.remove('hidden');
                return;
            }

            const response = await ipcRenderer.invoke('login', { email, password });
            if (response.success) {
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = response.message;
                errorMessage.classList.remove('hidden');
            }
        });
    }

    // Close modal
    if (logout_button) {
        logout_button.addEventListener("click", () => {
            ipcRenderer.invoke('logout');
        });
    }

    if (complaintInput) {
        // Load Complaints
        const loadComplaints = async () => {
            const complaints = await ipcRenderer.invoke('fetch-complaints');
            complaintList.innerHTML = '';

            if (complaints.length === 0) {
                complaintList.innerHTML = `<li class="text-center text-gray-500 py-2">No complaints found.</li>`;
                return;
            }

            complaints.forEach((complaint) => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-2 border-b';
                li.innerHTML = `
                <span>${complaint.name}</span>
                <button 
                    class="bg-blue-500 text-white py-1 px-2 rounded hover:bg-blue-600" 
                    data-id="${complaint.id}" 
                    data-name="${complaint.name}">
                    Edit
                </button>`;
                complaintList.appendChild(li);
            });

            // Attach Edit Event Listeners
            complaintList.querySelectorAll('button').forEach((button) => {
                button.addEventListener('click', () => {
                    const id = button.getAttribute('data-id');
                    const currentName = button.getAttribute('data-name');
                    editComplaint(id, currentName);
                });
            });
        };

        // Add Complaint
        const addComplaint = async () => {
            const complaint = complaintInput.value.trim();
            if (!complaint) {
                alert('Complaint cannot be empty!');
                return;
            }
            await ipcRenderer.invoke('add-complaint', complaint);
            complaintInput.value = '';
            loadComplaints();
        };

        // Edit Complaint
        const editComplaint = async (id, currentComplaint) => {
            const newComplaint = prompt('Edit Complaint:', currentComplaint);
            if (newComplaint) {
                await ipcRenderer.invoke('edit-complaint', id, newComplaint);
                loadComplaints();
            }
        };

        // Attach Add Complaint Button Event
        if (addComplaintBtn) {
            addComplaintBtn.addEventListener('click', addComplaint);
        }

        // Initial Load
        loadComplaints();
    }
    // Function to load complaints
    const loadUpdateComplaints = async () => {
        const complaints = await ipcRenderer.invoke("fetch-complaints");
        complaintList.innerHTML = ""; // Clear existing list

        complaints.forEach(complaint => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td class="px-4 py-2 text-sm">${complaint.name}</td>
                <td class="px-4 py-2 text-right">
                    <button class="bg-blue-500 text-white py-1 px-4 rounded-md hover:bg-blue-600 edit-btn" data-id="${complaint.id}" data-name="${complaint.name}">Edit</button>
                </td>
            `;

            const editBtn = row.querySelector(".edit-btn");
            editBtn.addEventListener("click", () => openEditModal(complaint.id, complaint.name));

            complaintList.appendChild(row);
        });
    };


    // Open modal to add complaint
    if (addComplaintBtn && complaintModal) {

        addComplaintBtn.addEventListener("click", () => {
            isEdit = false;
            complaintDescriptionInput.value = "";
            modalTitle.textContent = "Add Complaint";
            complaintModal.classList.remove("hidden");
        });
    }

    // Open modal to edit complaint
    const openEditModal = (id, name) => {
        isEdit = true;
        editComplaintId = id;
        modalTitle.textContent = "Edit Complaint";
        complaintDescriptionInput.value = name; // Pre-fill the input with the current complaint name
        complaintModal.classList.remove("hidden");
    };

    // Close modal
    if (cancelBtn && complaintModal) {
        cancelBtn.addEventListener("click", () => {
            complaintModal.classList.add("hidden");
        });
    }
    // Handle form submission (Add or Edit)
    if (complaintForm && complaintModal) {

        complaintForm.addEventListener("submit", async e => {
            e.preventDefault();

            const complaintDescription = complaintDescriptionInput.value.trim();
            if (!complaintDescription) {
                alert("Please enter a complaint.");
                return;
            }

            if (isEdit) {
                // Edit complaint
                const success = await ipcRenderer.invoke("edit-complaint", editComplaintId, complaintDescription);
                if (success) {
                    loadUpdateComplaints();
                    complaintModal.classList.add("hidden");
                } else {
                    alert("Error updating complaint.");
                }
            } else {
                // Add complaint
                const success = await ipcRenderer.invoke("add-complaint", complaintDescription);
                if (success) {
                    loadUpdateComplaints();
                    complaintModal.classList.add("hidden");
                } else {
                    alert("Error adding complaint.");
                }
            }
        });
    }

    // Search complaints functionality
    if (searchInput && complaintList) {

        searchInput.addEventListener("input", () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = complaintList.getElementsByTagName("tr");

            Array.from(rows).forEach(row => {
                const complaintText = row.getElementsByTagName("td")[0].textContent.toLowerCase();
                if (complaintText.includes(searchTerm)) {
                    row.classList.remove("hidden");
                } else {
                    row.classList.add("hidden");
                }
            });
        });
    }

    // Load complaints on page load
    if (complaintList) {
        loadUpdateComplaints();
    }


    // Elements
    const addServiceBtn = document.getElementById('addServiceBtn');
    const serviceModal = document.getElementById('serviceModal');
    const servicecancelBtn = document.getElementById('cancelBtn');
    const serviceForm = document.getElementById('serviceForm');
    const servicemodalTitle = document.getElementById('modalTitle');
    const serviceDescriptionInput = document.getElementById('serviceDescription');
    const servicePriceInput = document.getElementById('servicePrice');
    const serviceList = document.getElementById('serviceList');
    const servicesearchInput = document.getElementById('searchInput');

    let isServiceEdit = false;
    let editServiceId = null;

    if (serviceList) {

        // Populate Services List
        const loadServices = async () => {
            const services = await ipcRenderer.invoke('get-services');
            serviceList.innerHTML = services
                .map(
                    (service) => `
                        <tr>
                            <td class="px-4 py-2 text-sm">${service.name}</td>
                            <td class="px-4 py-2 text-sm text-center">${service.price}</td>
                            <td class="px-4 py-2 text-right">
                            <button
                                class="bg-blue-500 text-white py-1 px-4 rounded-md hover:bg-blue-600 edit-btn"
                                data-id="${service.id}"
                                data-name="${service.name}"
                                data-price="${service.price}"
                            >
                                Edit
                            </button>
                            </td>
                        </tr>
    `
                )
                .join('');
        };

        // Open Modal for Adding Service
        addServiceBtn.addEventListener('click', () => {
            isServiceEdit = false;
            serviceDescriptionInput.value = '';
            servicePriceInput.value = '';
            servicemodalTitle.textContent = 'Add Service';
            serviceModal.classList.remove('hidden');
        });

        // Open Modal for Editing Service
        serviceList.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                isServiceEdit = true;
                editServiceId = e.target.dataset.id;
                servicemodalTitle.textContent = 'Edit Service';
                serviceDescriptionInput.value = e.target.dataset.name;
                servicePriceInput.value = e.target.dataset.price;
                serviceModal.classList.remove('hidden');
            }
        });

        // Cancel Modal
        servicecancelBtn.addEventListener('click', () => {
            serviceModal.classList.add('hidden');
        });

        // Handle Form Submission
        serviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const service = serviceDescriptionInput.value.trim();
            const price = parseFloat(servicePriceInput.value.trim());

            if (isServiceEdit) {
                await ipcRenderer.invoke('update-service', editServiceId, service, price);
            } else {
                await ipcRenderer.invoke('add-service', service, price);
            }

            serviceModal.classList.add('hidden');
            loadServices();
        });

        servicesearchInput.addEventListener("input", () => {
            const searchTerm = servicesearchInput.value.toLowerCase();
            const rows = serviceList.getElementsByTagName("tr");

            Array.from(rows).forEach(row => {
                const serviceText = row.getElementsByTagName("td")[0].textContent.toLowerCase();
                if (serviceText.includes(searchTerm)) {
                    row.classList.remove("hidden");
                } else {
                    row.classList.add("hidden");
                }
            });
        });

        // Initial Load
        loadServices();
    }

});


document.addEventListener("DOMContentLoaded", async function () {
    // Set focus to Name field after page loads
    if (document.getElementById("name")) {
        document.getElementById("name").focus();

        // Fetch latest patient data using async IPC call
        const latest_case_no = await ipcRenderer.invoke("get-latest-case-no");
        const latest_reg_no = await ipcRenderer.invoke("get-latest-reg-no");

        // Simulate fetching latest case and reg numbers (this can come from an API or file in a real app)
        let latestCaseNo = 1;
        let latestRegNo = 69998;

        // If latest patients data exists, update case and reg numbers accordingly
        if (latest_case_no && latest_reg_no) {
            latestCaseNo = latest_case_no || latestCaseNo;
            latestRegNo = latest_reg_no || latestRegNo;
        }

        document.getElementById('latest_case_no').innerText = latestCaseNo;
        document.getElementById('latest_reg_no').innerText = latestRegNo;

        // Function to update the date and time
        function updateDateTime() {
            const currentDateTime = new Date();
            const formattedDateTime = currentDateTime.toLocaleString();
            document.getElementById("current_date_time").innerText = formattedDateTime;
        }

        // Set initial date and time
        updateDateTime();
        setInterval(updateDateTime, 1000); // Update every second

        // Handle complaints dropdown
        const searchInput = document.getElementById("searchInput");
        const dropdownMenu = document.getElementById("dropdownMenu");
        const checkboxList = document.getElementById("checkboxList");

        // Fetch complaints data
        const complaints = await ipcRenderer.invoke("fetch-complaints");

        // Populate checkbox list
        complaints.forEach(complaint => {
            const label = document.createElement("label");
            label.classList.add("flex", "items-center");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("form-checkbox", "text-indigo-600", "mr-2");
            checkbox.name = "complaints";
            checkbox.value = complaint.id;

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(complaint.name));

            checkboxList.appendChild(label);
        });
        if (searchInput) {

            // Toggle dropdown visibility on focus
            searchInput.addEventListener("focus", function () {
                dropdownMenu.classList.remove("hidden");
            });
        }

        // Close dropdown when clicked outside
        window.addEventListener("click", function (event) {
            if (!dropdownMenu.contains(event.target) && !searchInput.contains(event.target)) {
                dropdownMenu.classList.add("hidden");
            }
        });

        // Filter checkboxes based on search input
        searchInput.addEventListener("input", function () {
            const searchTerm = searchInput.value.toLowerCase();
            const checkboxes = checkboxList.getElementsByTagName("label");

            Array.from(checkboxes).forEach(function (checkbox) {
                const text = checkbox.textContent || checkbox.innerText;
                if (text.toLowerCase().indexOf(searchTerm) === -1) {
                    checkbox.classList.add("hidden");
                } else {
                    checkbox.classList.remove("hidden");
                }
            });
        });

        // Handle form submission
        document.getElementById("patient-form").addEventListener("submit", function (event) {
            event.preventDefault();
            // You can handle form data submission here
            const formData = {
                name: document.getElementById("name").value,
                guardian_name: document.getElementById("guardian_name").value,
                age: document.getElementById("age").value,
                gender: document.getElementById("gender").value,
                mobile_no: document.getElementById("mobile_no").value,
                address: document.getElementById("address").value,
                complaints: Array.from(document.querySelectorAll('input[name="complaints"]:checked')).map(input => input.value),
                weight: document.getElementById("weight").value,
                fever: document.getElementById("fever").value,
                pulse: document.getElementById("pulse").value,
                bp: document.getElementById("bp").value,
                spo2: document.getElementById("spo2").value,
                on_e: document.getElementById("on_e").value,
                cvs: document.getElementById("cvs").value,
                chest: document.getElementById("chest").value,
                cns: document.getElementById("cns").value,
                pa: document.getElementById("pa").value,
                investigation: document.getElementById("investigation").value,
                from_date: document.getElementById("from_date").value
            };

            ipcRenderer.send('save-patient-record', formData);
            console.log("Form submitted!");
            window.location.reload();
        });

        ipcRenderer.on('save-patient-success', (event, message) => {
            alert(message);  // Show success message
            // Optionally, clear the form or redirect
        });

        ipcRenderer.on('save-patient-error', (event, errorMessage) => {
            alert('Error: ' + errorMessage);  // Show error message
        });
    }


});


document.addEventListener("DOMContentLoaded", async function () {
    const patients = await ipcRenderer.invoke("get-all-patients");
    const cancelBtn = document.getElementById("cancelBtn");

    let currentPage = 1;
    const patientsPerPage = 10;

    // Handle search form submission
    if (document.getElementById("search-form") && document.getElementById("search")) {
        document.getElementById("search-form").addEventListener("submit", e => {
            e.preventDefault();
            const searchQuery = document.getElementById("search").value.toLowerCase();
            const startDate = document.getElementById("start_date").value;
            const endDate = document.getElementById("end_date").value;
            filterPatients(searchQuery, startDate, endDate);
        });
    }

    // Filter patients by search query and date range
    function filterPatients(searchQuery, startDate, endDate) {
        let filteredPatients = patients;

        if (searchQuery) {
            filteredPatients = filteredPatients.filter(patient => patient.name.toLowerCase().includes(searchQuery));
        }

        if (startDate && endDate) {
            filteredPatients = filteredPatients.filter(patient => {
                const patientDate = patient.date || ""; // Add date in the format YYYY-MM-DD in your data
                return patientDate >= startDate && patientDate <= endDate;
            });
        }

        renderPatients(filteredPatients);
    }

    function renderPatients(patientList) {
        const startIndex = (currentPage - 1) * patientsPerPage;
        const endIndex = startIndex + patientsPerPage;
        const paginatedPatients = patientList.slice(startIndex, endIndex);

        // Clear the existing table rows
        const patientListElement = document.getElementById("patient-list");
        if (patientListElement) {
            patientListElement.innerHTML = "";

            // Add new rows to the table
            paginatedPatients.forEach(patient => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td class="px-4 py-2 border-b">${patient.reg_no}</td>
                    <td class="px-4 py-2 border-b text-center">${patient.name}</td>
                    <td class="px-4 py-2 border-b text-center">${patient.age}</td>
                    <td class="px-4 py-2 border-b text-center">${patient.gender}</td>
                    <td class="px-4 py-2 border-b text-center">${patient.mobile_no}</td>
                    <td class="px-4 py-2 border-b text-center">${patient.date}</td>
                    <td class="px-4 py-2 border-b text-right">
                        <button class="edit-button bg-blue-500 text-white py-1 px-4 rounded-md hover:bg-blue-600" data-id="${patient.id}">Edit</button>
                        <button class="bg-red-500 text-white py-1 px-4 rounded-md hover:bg-red-600 delete-button" data-id="${patient.id}">Delete</button>
                        <button class="view-button bg-green-500 text-white py-1 px-4 rounded-md hover:bg-green-600" data-id="${patient.id}">View</button>
                    </td>
                `;
                patientListElement.appendChild(row);
            });

            // Attach event listeners for "View" buttons
            const viewButtons = document.querySelectorAll(".view-button");
            viewButtons.forEach(button => {
                button.addEventListener("click", (e) => {
                    const patientId = parseInt(e.target.getAttribute("data-id"));
                    viewPatientDetails(patientId);
                });
            });


            // Attach event listeners for edit and delete buttons
            const editButtons = document.querySelectorAll(".edit-button");
            editButtons.forEach(button => {
                button.addEventListener("click", (e) => {
                    const patientId = parseInt(e.target.getAttribute("data-id"));
                    openPatientEditModal(patientId);
                });
            });

            const deleteButtons = document.querySelectorAll(".delete-button");
            deleteButtons.forEach(button => {
                button.addEventListener("click", (e) => {
                    const patientId = parseInt(e.target.getAttribute("data-id"));
                    deletePatient(patientId);
                });
            });

            // Render pagination
            renderPagination(patientList.length);
        }
    }

    // View patient details in the modal
    function viewPatientDetails(patientId) {
        const patient = patients.find(p => p.id === patientId);
        if (patient) {
            // Fill the modal with patient data
            document.getElementById("patient-name").textContent = patient.name;
            document.getElementById("patient-age").textContent = patient.age;
            document.getElementById("patient-gender").textContent = patient.gender;
            document.getElementById("patient-mobile").textContent = patient.mobile_no;
            document.getElementById("patient-address").textContent = patient.address;
            document.getElementById("patient-reg_no").textContent = patient.reg_no;
            document.getElementById("patient-case_no").textContent = patient.case_no;
            document.getElementById("patient-date").textContent = patient.date;
            document.getElementById("patient-valid_upto").textContent = patient.valid_upto;
            document.getElementById("patient-from_date").textContent = patient.from_date;
            if (patient.weight) {
                document.getElementById("patient-weight").textContent = `${patient.weight} Kg`;
            }
            if (patient.fever) {
                document.getElementById("patient-fever").textContent = `${patient.fever} °F`;
            }
            document.getElementById("patient-bp").textContent = patient.bp;
            if (patient.pulse) {
                document.getElementById("patient-pulse").textContent = `${patient.pulse}  /m`;
            }
            if (patient.spo2) {
                document.getElementById("patient-spo2").textContent = `${patient.spo2} %`;
            }
            document.getElementById("patient-cvs").textContent = patient.cvs;
            document.getElementById("patient-chest").textContent = patient.chest;
            document.getElementById("patient-cns").textContent = patient.cns;
            document.getElementById("patient-pa").textContent = patient.pa;
            // document.getElementById("patient-complaints").textContent = patient.complaints;

            // Show the modal
            document.getElementById("view-patient-modal").classList.remove("hidden");
        }
    }

    // Close the modal
    if (document.getElementById("close-view-modal")) {
        document.getElementById("close-view-modal").addEventListener("click", function () {
            document.getElementById("view-patient-modal").classList.add("hidden");
        });
    }


    // Handle delete patient action
    async function deletePatient(patientId) {
        if (confirm("Are you sure you want to delete this patient?")) {
            try {
                const result = await ipcRenderer.invoke('delete-patient', patientId); // Call ipcRenderer
                if (result.success) {
                    // Refresh the patient list after deletion
                    const patientList = patients.filter(patient => patient.id !== patientId); // Remove deleted patient from list
                    renderPatients(patientList);
                } else {
                    alert("Failed to delete patient.");
                }
            } catch (error) {
                console.error("Error deleting patient:", error);
                alert("An error occurred while deleting the patient.");
            }
        }
    }

    // Change page
    function changePage(page) {
        currentPage = page;
        renderPatients(patients);
    }

    // Render pagination controls
    function renderPagination(totalPatients) {
        const totalPages = Math.ceil(totalPatients / patientsPerPage);
        const paginationElement = document.getElementById("pagination");
        paginationElement.innerHTML = `
            <div class="flex justify-between">
                <span class="text-sm text-gray-700">Page ${currentPage} of ${totalPages}</span>
                <div class="flex space-x-2">
                    ${currentPage > 1
                ? `<a href="#" class="pagination-link" data-page="1" class="px-4 py-2 bg-indigo-600 text-white rounded-md">First</a>
                            <a href="#" class="pagination-link" data-page="${currentPage - 1}" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Previous</a>`
                : ""
            }
                    ${currentPage < totalPages
                ? `<a href="#" class="pagination-link" data-page="${currentPage + 1}" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Next</a>
                            <a href="#" class="pagination-link" data-page="${totalPages}" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Last</a>`
                : ""
            }
                </div>
            </div>
        `;

        // Attach click event listeners to pagination links
        const paginationLinks = document.querySelectorAll(".pagination-link");
        paginationLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                const page = parseInt(e.target.getAttribute("data-page"));
                changePage(page);
            });
        });
    }

    // Initialize the page
    renderPatients(patients);

    // Handle complaints dropdown
    const searchInput = document.getElementById("searchInput");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const checkboxList = document.getElementById("checkboxList");

    // Fetch complaints data
    const complaints = await ipcRenderer.invoke("fetch-complaints");

    if (checkboxList) {

        // Populate checkbox list
        complaints.forEach(complaint => {
            const label = document.createElement("label");
            label.classList.add("flex", "items-center");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("form-checkbox", "text-indigo-600", "mr-2");
            checkbox.name = "complaints";
            checkbox.value = complaint.id;

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(complaint.name));

            checkboxList.appendChild(label);
        });
    }


    // Toggle dropdown visibility on focus
    if (searchInput) {
        searchInput.addEventListener("focus", function () {
            dropdownMenu.classList.remove("hidden");
        });
    }

    // Close dropdown when clicked outside
    if (dropdownMenu && searchInput) {
        window.addEventListener("click", function (event) {
            if (!dropdownMenu.contains(event.target) && !searchInput.contains(event.target)) {
                dropdownMenu.classList.add("hidden");
            }
        });
    }


    // Filter checkboxes based on search input
    if (searchInput) {

        searchInput.addEventListener("input", function () {
            const searchTerm = searchInput.value.toLowerCase();
            const checkboxes = checkboxList.getElementsByTagName("label");

            Array.from(checkboxes).forEach(function (checkbox) {
                const text = checkbox.textContent || checkbox.innerText;
                if (text.toLowerCase().indexOf(searchTerm) === -1) {
                    checkbox.classList.add("hidden");
                } else {
                    checkbox.classList.remove("hidden");
                }
            });
        });
    }


    // Open the modal with the current patient data
    function openPatientEditModal(patientId) {
        const patient = patients.find(p => p.id === patientId);
        if (patient) {
            // Fill in the form with the current patient data
            document.getElementById("edit-id").value = patient.id;
            document.getElementById("edit-name").value = patient.name;
            document.getElementById("edit-guardian_name").value = patient.guardian_name;
            document.getElementById("edit-age").value = patient.age;
            document.getElementById("edit-gender").value = patient.gender;
            document.getElementById("edit-mobile_no").value = patient.mobile_no;
            document.getElementById("edit-address").value = patient.address;
            document.getElementById("edit-weight").value = patient.weight;
            document.getElementById("edit-fever").value = patient.fever;
            document.getElementById("edit-pulse").value = patient.pulse;
            document.getElementById("edit-bp").value = patient.bp;
            document.getElementById("edit-spo2").value = patient.spo2;
            document.getElementById("edit-on_e").value = patient.on_e;
            document.getElementById("edit-cvs").value = patient.cvs;
            document.getElementById("edit-chest").value = patient.chest;
            document.getElementById("edit-cns").value = patient.cns;
            document.getElementById("edit-pa").value = patient.pa;
            document.getElementById("edit-investigation").value = patient.investigation;
            document.getElementById("edit-from_date").value = patient.from_date;

            ipcRenderer.invoke('get-complaints', patientId)
                .then(complaints => {
                    console.log('Complaints for patient:', complaints);
                    // Process the complaints data here (e.g., display it in the UI)
                    // Handle the checkboxes for complaints
                    complaints.forEach(complaint => {
                        const checkbox = document.querySelector(`input[name="complaints"][value="${complaint.id}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                })
                .catch(err => {
                    console.error('Error fetching complaints:', err);
                });


            // Show the modal
            document.getElementById("edit-patient-modal").classList.remove("hidden");
        }
    }

    // Close modal
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            document.getElementById("edit-patient-modal").classList.add("hidden");
        });
    }

    // Close the modal
    function closeModal() {
        document.getElementById("edit-patient-modal").classList.add("hidden");
    }

    // Handle form submission to update patient data
    if (document.getElementById("edit-patient-form")) {
        document.getElementById("edit-patient-form").addEventListener("submit", async function (e) {
            e.preventDefault();

            // Collect all the form data
            const formData = {
                id: document.getElementById("edit-id").value,
                name: document.getElementById("edit-name").value,
                guardian_name: document.getElementById("edit-guardian_name").value,
                age: document.getElementById("edit-age").value,
                gender: document.getElementById("edit-gender").value,
                mobile_no: document.getElementById("edit-mobile_no").value,
                address: document.getElementById("edit-address").value,
                complaints: Array.from(document.querySelectorAll('input[name="complaints"]:checked')).map(input => input.value),
                weight: document.getElementById("edit-weight").value,
                fever: document.getElementById("edit-fever").value,
                pulse: document.getElementById("edit-pulse").value,
                bp: document.getElementById("edit-bp").value,
                spo2: document.getElementById("edit-spo2").value,
                on_e: document.getElementById("edit-on_e").value,
                cvs: document.getElementById("edit-cvs").value,
                chest: document.getElementById("edit-chest").value,
                cns: document.getElementById("edit-cns").value,
                pa: document.getElementById("edit-pa").value,
                investigation: document.getElementById("edit-investigation").value,
                from_date: document.getElementById("edit-from_date").value
            };

            console.log(formData)

            try {
                // Update the patient data
                const updatedPatient = await ipcRenderer.invoke("update-patient", formData,);
                console.log(updatedPatient)
                window.location.reload()
            } catch (error) {
                console.error("Error updating patient:", error);
                alert("An error occurred while updating the patient.");
            }
        });
    }

    if (document.getElementById("print-model")) {
        document.getElementById("print-model").addEventListener("click", function () {
            // Get the print section element
            var printSection = document.getElementById("print");

            if (printSection) {
                // Open a new window for printing
                var printWindow = window.open('', '', 'height=800,width=600');

                // Write the content of the print section to the new window
                printWindow.document.write('<html><head><title>Patient Details</title>');
                printWindow.document.write('<link rel="stylesheet" href="./styles/tailwind.css" /> <link rel="stylesheet" href="./styles/style.css" />');
                printWindow.document.write('<style>');
                // Add inline styles to ensure the layout is correct
                printWindow.document.write(`
                    #print {
                        width: 210mm;
                        height: 297mm;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        margin: 0; /* Remove default margins */
                        padding: 0; /* Remove default padding */
                    }
                    /* Add any additional styles here */
                `);
                printWindow.document.write(`
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        margin: 0; /* Remove default margins */
                        padding: 0; /* Remove default padding */
                    }
                    
                }
            `);
                printWindow.document.write('</style></head><body>');
                printWindow.document.write(printSection.innerHTML);  // Insert content for printing
                printWindow.document.write('</body></html>');

                // Close the document and trigger the print dialog after a short delay
                printWindow.document.close();

                // Wait for styles to load before printing
                printWindow.onload = function () {
                    setTimeout(function () {
                        printWindow.print(); // Call print after a slight delay
                    }, 500);  // Adjust the delay if necessary
                };
            }
        });
    }


});

document.addEventListener("DOMContentLoaded", async function () {
    const services = await ipcRenderer.invoke('get-services');
    populateServicesDropdown(services);

    // Populate the service dropdown dynamically
    function populateServicesDropdown(services) {
        const serviceSelects = document.querySelectorAll('.service-select');
        const lastServiceSelect = serviceSelects[serviceSelects.length - 1];
        if (lastServiceSelect) {
            // Clear existing options to prevent duplication
            lastServiceSelect.innerHTML = '<option value="">Select Service</option>';

            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = `${service.name} - ₹${service.price}`;
                option.setAttribute('data-price', service.price);
                lastServiceSelect.appendChild(option);
            });
        }
    }

    // Add a new service selection row
    const addServiceButton = document.getElementById("addServiceButton");
    if (addServiceButton) {
        addServiceButton.addEventListener("click", () => {
            populateServicesDropdown(services); // Pass services to the addService function
        });
    }

    // Handle form submission
    if (document.getElementById("serviceForm")) {

        document.getElementById("serviceForm").addEventListener("submit", function (event) {
            event.preventDefault();

            const services = [];
            document.querySelectorAll(".service-item").forEach(item => {
                const serviceSelect = item.querySelector(".service-select");
                const quantityInput = item.querySelector(".quantity-input");
                if (serviceSelect.value && quantityInput.value) {
                    services.push({
                        service: serviceSelect.value,
                        quantity: parseInt(quantityInput.value),
                    });
                }
            });

            console.log("Selected Services:", services);
            const reg_no = document.getElementById("reg_no").value;
            console.log(reg_no)
            // Send data to the Electron main process
            const data = ipcRenderer.invoke("create-service-order", services, reg_no);
            console.log(data)
            window.location.reload()
        });
    }


    // Populate invoices dynamically
    async function loadInvoices(query = {}, page = 1) {
        try {
            const response = await ipcRenderer.invoke('get-invoices', { ...query, page });
            const { invoices, totalAmount, currentPage, totalPages } = response;

            // Update total amount
            document.getElementById('totalAmount').textContent = totalAmount;

            // Render invoices
            const invoicesContainer = document.getElementById('invoicesContainer');
            invoicesContainer.innerHTML = '';
            invoices.forEach(invoice => {
                const invoiceElement = document.createElement('div');
                const formattedDate = formatDateTime(invoice.date);

                invoiceElement.className = 'invoice mb-6 p-4 bg-gray-100 rounded-lg';
                invoiceElement.innerHTML = `
                    <div class="flex justify-between">
                        <h3 class="text-lg font-semibold mb-2">Invoice ${invoice.id}</h3>
                        <div class="flex">
                        <a href="#" class="edit-button bg-blue-500 text-white py-1 px-4 rounded-md hover:bg-blue-600" data-id="${invoice.id}" >Edit</a> &nbsp;
                        <a href="#" class="view-button bg-green-500 text-white py-1 px-4 rounded-md hover:bg-green-600" data-id="${invoice.id}">Print</a>
                        </div>
                    </div>
                    <h3 class="text-lg font-semibold mb-2">${invoice.patientName}</h3>
                    <p><strong>Date:</strong> ${formattedDate}</p>
                    <p><strong>Total Amount:</strong> ₹${invoice.totalAmount}</p>
        
                    <h4 class="mt-4 font-semibold">Items</h4>
                    <table class="w-full text-left border mt-2">
                        <thead>
                        <tr>
                            <th class="p-2 border">Service</th>
                            <th class="p-2 border">Quantity</th>
                            <th class="p-2 border">Price</th>
                            <th class="p-2 border">Total Price</th>
                        </tr>
                        </thead>
                        <tbody>
                        ${invoice.items.map(item => `
                            <tr>
                            <td class="p-2 border">${item.serviceName}</td>
                            <td class="p-2 border">${item.quantity}</td>
                            <td class="p-2 border">₹${item.servicePrice}</td>
                            <td class="p-2 border">₹${item.lineTotal}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                `;
                invoicesContainer.appendChild(invoiceElement);
            });

            // Attach event listeners for "View" buttons
            const viewButtons = document.querySelectorAll(".view-button");
            viewButtons.forEach(button => {
                button.addEventListener("click", (e) => {
                    const invoiceId = parseInt(e.target.getAttribute("data-id"));
                    viewInvoiceDetails(invoiceId);
                });
            });


            // Attach event listeners for edit and delete buttons
            const editButtons = document.querySelectorAll(".edit-button");
            editButtons.forEach(button => {
                button.addEventListener("click", (e) => {
                    const invoiceId = parseInt(e.target.getAttribute("data-id"));
                    openInvoiceEditModal(invoiceId);
                });
            });

            // View patient details in the modal
            function viewInvoiceDetails(invoiceId) {
                const invoice = invoices.find(p => p.id === invoiceId);
                if (invoice) {
                    // Fill the modal with invoice data
                    const formattedDate = formatDateTime(invoice.date);
                    // document.getElementById("modal-invoice-id").textContent = `Invoice ID: ${invoice.id}`;
                    document.getElementById("invoice-patient_name").textContent = `Patient Name: ${invoice.patientName}`;
                    document.getElementById("invoice-date").textContent = ` ${formattedDate}`;
                    document.getElementById("invoice-age").textContent = `${invoice.patientAge}`;
                    document.getElementById("invoice-gender").textContent = `${invoice.patientGender}`;
                    document.getElementById("invoice-guardian_name").textContent = `Guardian Name: ${invoice.patientGuardianName}`;
                    document.getElementById("invoice-mobile_no").textContent = `${invoice.patientMobileNo}`;
                    document.getElementById("invoice-address").textContent = `${invoice.patientAddress}`;

                    const itemsTableBody = document.getElementById("modal-items-body");

                    // Generate table rows for items
                    let itemsRows = invoice.items.map(item => `
                        <tr>
                            <td class="p-2 border">${item.serviceName}</td>
                            <td class="p-2 border">${item.quantity}</td>
                            <td class="p-2 border">₹${item.servicePrice}</td>
                            <td class="p-2 border">₹${item.lineTotal}</td>
                        </tr>`).join('');

                    // Add total row at the end
                    itemsRows += `
                        <tr>
                            <th class="p-2 border">Total</th>
                            <th class="p-2 border"></th>
                            <th class="p-2 border"></th>
                            <th class="p-2 border">₹${invoice.totalAmount}</th>
                        </tr>`;

                    // Populate the table body
                    itemsTableBody.innerHTML = itemsRows;

                    // Show the modal
                    document.getElementById("view-invoice-modal").classList.remove("hidden");
                }
            }

            // Close the modal
            if (document.getElementById("close-invoice-modal")) {
                document.getElementById("close-invoice-modal").addEventListener("click", function () {
                    document.getElementById("view-invoice-modal").classList.add("hidden");
                });
            }

            // Open the modal with the current invoice data
            function openInvoiceEditModal(invoiceId) {
                const invoice = invoices.find(p => p.id === invoiceId);
                console.log(invoice)
                if (invoice) {
                    document.getElementById("edit-reg_no").value = invoice.patientRegNo;
                    document.getElementById("edit-id").value = invoice.id;
                    document.getElementById("edit-totalAmount").textContent = invoice.totalAmount;

                    // Clear the service container and populate services dropdown
                    const serviceContainer = document.getElementById("serviceContainer");
                    serviceContainer.innerHTML = ""; // Clear existing service rows
                    populateServicesDropdown(services);

                    // Populate invoice items
                    invoice.items.forEach(item => {
                        const serviceRow = document.createElement("div");
                        serviceRow.className = "service-item flex items-center space-x-4";
                        serviceRow.innerHTML = `
                            <select class="service-select border p-2 rounded w-full" onchange="updateTotal(this)">
                                <option value="">Select Service</option>
                            </select>
                            <input type="number" min="1" value="${item.quantity}" class="quantity-input border p-2 rounded w-20" placeholder="Qty" oninput="updateTotal(this)" />
                            <span class="service-price text-gray-600">Price: ₹${item.servicePrice}</span>
                            <span class="total-price text-green-600 ml-4">Total: ₹${(Number(item.servicePrice) * item.quantity).toFixed(2)}</span>
                            <button type="button" onclick="removeService(this)" class="text-red-500 font-bold">x</button>
                            `;

                        // Populate the service select dropdown
                        const serviceSelect = serviceRow.querySelector(".service-select");
                        services.forEach(service => {
                            const option = document.createElement("option");
                            option.value = service.id;
                            option.textContent = `${service.name} - ₹${service.price}`;
                            option.setAttribute('data-price', service.price);
                            if (String(service.id) === String(item.serviceId)) {
                                option.selected = true;
                            }
                            serviceSelect.appendChild(option);
                        });

                        // Append the new service row to the container
                        serviceContainer.appendChild(serviceRow);
                    });

                    // Show the modal
                    document.getElementById("edit-invoice-modal").classList.remove("hidden");
                }
            }


            // Close the modal
            if (document.getElementById("close-edit-modal")) {
                document.getElementById("close-edit-modal").addEventListener("click", function () {
                    document.getElementById("edit-invoice-modal").classList.add("hidden");
                });
            }


            if (document.getElementById("print-invoice-model")) {
                document.getElementById("print-invoice-model").addEventListener("click", function () {
                    // Get the print section element
                    var printSection = document.getElementById("print");

                    if (printSection) {
                        // Open a new window for printing
                        var printWindow = window.open('', '', 'height=800,width=600');

                        // Write the content of the print section to the new window
                        printWindow.document.write('<html><head><title>Patient Details</title>');
                        printWindow.document.write('<link rel="stylesheet" href="./styles/tailwind.css" /> <link rel="stylesheet" href="./styles/style.css" />');
                        printWindow.document.write('<style>');
                        // Add inline styles to ensure the layout is correct
                        printWindow.document.write(`
                            #print {
                                width: 210mm;
                                height: 297mm;
                                box-sizing: border-box;
                                display: flex;
                                flex-direction: column;
                            }
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                                margin: 0; /* Remove default margins */
                                padding: 0; /* Remove default padding */
                            }
                            /* Add any additional styles here */
                        `);
                        printWindow.document.write(`
                            @media print {
                                body {
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                    margin: 0; /* Remove default margins */
                                    padding: 0; /* Remove default padding */
                                }
                                
                            }
                        `);
                        printWindow.document.write('</style></head><body>');
                        printWindow.document.write(printSection.innerHTML);  // Insert content for printing
                        printWindow.document.write('</body></html>');

                        // Close the document and trigger the print dialog after a short delay
                        printWindow.document.close();

                        // Wait for styles to load before printing
                        printWindow.onload = function () {
                            setTimeout(function () {
                                printWindow.print(); // Call print after a slight delay
                            }, 500);  // Adjust the delay if necessary
                        };
                    }
                });
            }


            // Pagination
            const paginationInfo = document.getElementById('paginationInfo');
            paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;

            const paginationButtons = document.getElementById('paginationButtons');
            paginationButtons.innerHTML = '';
            if (currentPage > 1) {
                paginationButtons.innerHTML += `
              <button onclick="loadInvoices({}, 1)" class="px-4 py-2 bg-indigo-600 text-white rounded-md">First</button>
              <button onclick="loadInvoices({}, ${currentPage - 1})" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Previous</button>
            `;
            }
            if (currentPage < totalPages) {
                paginationButtons.innerHTML += `
              <button onclick="loadInvoices({}, ${currentPage + 1})" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Next</button>
              <button onclick="loadInvoices({}, ${totalPages})" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Last</button>
            `;
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        }
    }


    // Initialize
    if (document.getElementById('searchForm')) {
        document.getElementById('searchForm').addEventListener('submit', (event) => {
            event.preventDefault();
            const query = {
                search: document.getElementById('searchQuery').value,
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
            };
            loadInvoices(query);
        });
    }


    if (document.getElementById('invoicesContainer')) {
        loadInvoices();
    }

    // Handle form submission
    if (document.getElementById("edit-serviceForm")) {

        document.getElementById("edit-serviceForm").addEventListener("submit", function (event) {
            event.preventDefault();

            const services = [];
            document.querySelectorAll(".service-item").forEach(item => {
                const serviceSelect = item.querySelector(".service-select");
                const quantityInput = item.querySelector(".quantity-input");
                if (serviceSelect.value && quantityInput.value) {
                    services.push({
                        service: serviceSelect.value,
                        quantity: parseInt(quantityInput.value),
                    });
                }
            });

            console.log("Selected Services:", services);
            const reg_no = document.getElementById("edit-reg_no").value;
            const id = document.getElementById("edit-id").value;
            console.log(reg_no, id)
            // Send data to the Electron main process
            const data = ipcRenderer.invoke("update-service-order", services, reg_no, id);
            console.log(data)
            window.location.reload()
        });
    }


})
