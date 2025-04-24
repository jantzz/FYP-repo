-- defines all possible actions in the system
CREATE TABLE permission (
    permissionId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- connects roles to their permissions
CREATE TABLE role_permission (
    rolePermissionId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    roleName VARCHAR(50) NOT NULL,
    permissionId INT UNSIGNED NOT NULL,
    FOREIGN KEY (roleName) REFERENCES role(roleName)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (permissionId) REFERENCES permission(permissionId)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (roleName, permissionId)
);

-- insert predefined roles first
INSERT IGNORE INTO role (roleName, description) VALUES
('Admin', 'System administrator with full access'),
('Manager', 'Department manager with supervisory permissions'),
('Employee', 'Regular employee account');

-- insert department fields 
INSERT IGNORE INTO department (departmentName, description, shifting) VALUES
('Doctor', 'Doctor department', true),
('Nurse', 'Nurse department', true),
('Receptionist', 'Receptionist department', true);

-- insert basic permissions for availability management
INSERT INTO permission (name, description) VALUES
('availability.submit', 'Can submit personal availability'),
('availability.view_own', 'Can view own availability'),
('availability.view_all', 'Can view all employees'' availability'),
('availability.approve', 'Can approve/decline availability requests'),
('availability.edit_own', 'Can edit own pending availability');

-- Assign permissions to roles
-- For Employee
INSERT INTO role_permission (roleName, permissionId)
SELECT 'Employee', permissionId FROM permission 
WHERE name IN ('availability.submit', 'availability.view_own', 'availability.edit_own');

-- For Manager
INSERT INTO role_permission (roleName, permissionId)
SELECT 'Manager', permissionId FROM permission;

-- For Admin
INSERT INTO role_permission (roleName, permissionId)
SELECT 'Admin', permissionId FROM permission;

-- insert test accounts
INSERT INTO user (name, email, password, role, birthday, gender, department) VALUES
('Admin User', 'admin@mail.com', 'test123', 'Admin', '1990-01-01', 'Male', 'Administration'),
('Manager User', 'manager@mail.com', 'test123', 'Manager', '1985-05-15', 'Female', 'Manager '),
('Employee User', 'employee@mail.com', 'test123', 'Employee', '1995-10-20', 'Male', 'Employee');