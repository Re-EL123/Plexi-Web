import re
import os
import glob

# Collect all classes defined in CSS files
css_classes = set()
css_files = glob.glob('assets/css/*.css')

for file_path in css_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # Simple regex to find selectors starting with .
        matches = re.findall(r'\.([a-zA-Z0-9_-]+)', content)
        for match in matches:
            css_classes.add(match)

# Add keyframe names and standard utility classes manually if needed, or just let them stand
# Now scan dashboard HTML files for classes
html_files = glob.glob('dashboard/*.html')
missing_by_file = {}

for file_path in html_files:
    missing_by_file[file_path] = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # Find all class="..."
        class_attribs = re.findall(r'class=["\']([^"\']+)["\']', content)
        for attrib in class_attribs:
            classes = attrib.split()
            for cls in classes:
                # ignore dynamic / template classes like stagger-child, delay-1, delay-2, delay-3 etc.
                if cls in ['active', 'show', 'unread', 'danger', 'table-actions']:
                    continue
                if re.match(r'^(delay-\d+|stagger-child|mt-\w+|mb-\w+|p-\d+|m-\d+)$', cls):
                    continue
                if cls not in css_classes:
                    missing_by_file[file_path].add(cls)

# Print results
for file_path, missing in missing_by_file.items():
    print(f"=== {file_path} ===")
    for cls in sorted(missing):
        print(f"  Missing: {cls}")
