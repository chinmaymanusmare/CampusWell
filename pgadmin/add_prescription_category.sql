-- Add category column to prescriptions table
ALTER TABLE prescriptions 
ADD COLUMN category VARCHAR(50);

-- Comment on the column
COMMENT ON COLUMN prescriptions.category IS 'Indicates if prescription is general or specialized';

-- Add check constraint to validate category values
ALTER TABLE prescriptions 
ADD CONSTRAINT valid_prescription_category 
CHECK (category IN ('general', 'specialized'));