$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:LOWER_FACE_K = '0.99'; $env:UPPER_LID_DROP = '3.5'; $env:LOWER_LID_RAISE = '1.0'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/sera2_head.glb C:/w/mhlab/sera_wrapped_jaw.fbx C:/w/mhlab/sera_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|out)"
$env:UPPER_LID_DROP = '0'; $env:LOWER_LID_RAISE = '0'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
& C:\w\mhlab\jaw_chain.ps1 -Name Sera -Hair WI_Hair_L_Straight -HairParams "Melanin=0,Whiteness=1,Redness=0" -IrisTint "0.85,0.88,0.9" -IrisSat "0.3" -Brow "" -BrowParams "" -Cap "0" -Darken "0" -UseHairMesh "0"
