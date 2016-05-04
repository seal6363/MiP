source 'https://github.com/CocoaPods/Specs.git'
source 'git@bitbucket.org:wantoto/wantoto-podspec.git'
use_frameworks!

target_name = 'OJBDevicePlayground'

target target_name do
  pod 'OJBridge', '~> 0.0.7'
end

target "#{target_name}Tests" do
  pod 'OJBridge', '~> 0.0.7'
end

# Installer hooks --------------------------------------------------------------

post_install do |installer|


  sandbox = installer.sandbox
  resource_copy_script = "#{sandbox.target_support_files_dir "Pods-#{target_name}/Pods-#{target_name}-resources.sh"}"
  pod_dir = sandbox.pod_dir "OJBridge"
  resource_path = "scripts/encrypted"


  puts "\n- Start modify the resource copy script: \n#{resource_copy_script}"

  # Read the content of the original copy resource script:
  lines = File.readlines resource_copy_script

  # Get the related path of all the required resources:
  resources = []
  Dir.chdir("#{pod_dir}/#{resource_path}/") do
    for file in Dir.glob("*.es") do
      resources.push("OJBridge/#{resource_path}/#{file}")
    end
  end
  puts "- Discovered resources:"
  puts resources

  # Modify the copy script
  read_install_resource = false;
  read_basket_count = 0;
  File.open('temp.sh', 'w') do |write_file|
    for line in lines do
      write_file.puts line

      if line.match 'install_resource()'
        read_install_resource = true
      end

      if line.match('{') and read_install_resource
        read_basket_count += 1
      end

      if line.match('}') and read_install_resource
        read_basket_count -= 1

        if read_basket_count == 0
          read_install_resource = false

          for path in resources do
              write_file.puts "install_resource #{path}"
          end
        end
      end

    end
  end

  puts "- Replace the resource copy script"

  File.rename("temp.sh", resource_copy_script)
  File.chmod(0755, resource_copy_script)

  puts "- Done."

end
