$baseUrl = "https://codejr.org/scratchjr/svglibrary/"

$sprites = @(
    "Tic.svg","Star.svg","Cat.svg","Dog.svg","Rabbit.svg","Chicken.svg","Pig.svg","Horse.svg",
    "Zebra.svg","Monkey.svg","Penguin.svg","Elephant.svg","Giraffe.svg","Frog.svg","Butterfly.svg",
    "Crab.svg","Whale.svg","Dragon.svg","Fairy.svg","Wizard.svg","Astronaut.svg","Boy1.svg","Boy2.svg",
    "Boy3.svg","Girl1.svg","Girl2.svg","Girl3.svg","Father.svg","Mother.svg","Baby.svg","Grandma.svg",
    "Grandpa.svg","Teacher.svg","Firefighter.svg","Police.svg","Doctor.svg","Chef.svg","Farmer.svg",
    "Dancer.svg","Singer.svg","Athlete.svg","Superhero.svg","Princess.svg","Knight.svg","Pirate.svg",
    "Ninja.svg","Witch.svg","Ghost.svg","Robot.svg","Alien.svg","Dinosaur.svg","Bear.svg","Lion.svg",
    "Tiger.svg","Fox.svg","Deer.svg","Owl.svg","Parrot.svg","Flamingo.svg","Toucan.svg","Crocodile.svg",
    "Snake.svg","Turtle.svg","Fish.svg","Shark.svg","Dolphin.svg","Seahorse.svg","Starfish.svg",
    "Jellyfish.svg","Lobster.svg","Duck.svg","Goose.svg","Sheep.svg","Cow.svg","Goat.svg","Donkey.svg",
    "Camel.svg","Kangaroo.svg","Koala.svg","Panda.svg","Gorilla.svg","Cheetah.svg","Hippo.svg",
    "Rhino.svg","Moose.svg","Wolf.svg","Squirrel.svg","Hedgehog.svg","Bat.svg","Bee.svg","Ladybug.svg",
    "Snail.svg","Spider.svg","Ant.svg","Dragonfly.svg","Caterpillar.svg","Mushroom.svg","Flower.svg",
    "Tree.svg","Sun.svg","Moon.svg","Rainbow.svg","Cloud.svg","Lightning.svg","Snowflake.svg","Fire.svg",
    "Earth.svg","Rocket.svg","Car.svg","Bus.svg","Train.svg","Boat.svg","Airplane.svg","Bicycle.svg",
    "House.svg","Castle.svg","Tower.svg","Bridge.svg","Apple.svg","Banana.svg","Pizza.svg","Cake.svg",
    "Cookie.svg","Icecream.svg","Mermaid.svg","Unicorn.svg","Phoenix.svg","Gnome.svg","Elf.svg",
    "Vampire.svg","Zombie.svg","Pegasus.svg","Octopus.svg","Monster.svg"
)

$backgrounds = @(
    "Classroom.svg","Bedroom.svg","Library.svg","Farm.svg","City.svg","Park.svg","Desert.svg",
    "Jungle.svg","Castle.svg","Space.svg","Underwater.svg","Forest.svg","Ocean.svg","Beach.svg",
    "Mountain.svg","Playground.svg","Kitchen.svg","Hospital.svg","Stadium.svg","Theater.svg",
    "Museum.svg","Airport.svg","Harbor.svg","Village.svg","Street.svg","Night.svg","Sunset.svg",
    "Snow.svg","Cave.svg","Volcano.svg","Treehouse.svg","Garden.svg","Backyard.svg","Meadow.svg",
    "Savanna.svg","Rainforest.svg","Swamp.svg","Tundra.svg","Campsite.svg","Pond.svg","River.svg",
    "Lake.svg","Woods.svg","SeaFloor.svg","Seabed.svg"
)

$foundSprites = @()
$foundBackgrounds = @()
$notFound = @()

Write-Host "=== PROBING SPRITE CANDIDATES ===" -ForegroundColor Cyan
Write-Host "Total to test: $($sprites.Count)" -ForegroundColor Gray
Write-Host ""

foreach ($file in $sprites) {
    $url = "$baseUrl$file"
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 8 -ErrorAction Stop
        $status = $response.StatusCode
        if ($status -eq 200) {
            Write-Host "  [OK] $file" -ForegroundColor Green
            $foundSprites += $file
        } else {
            Write-Host "  [$status] $file" -ForegroundColor Yellow
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code) {
            Write-Host "  [$code] $file" -ForegroundColor DarkGray
        } else {
            Write-Host "  [ERR] $file - $($_.Exception.Message)" -ForegroundColor Red
        }
        $notFound += $file
    }
    Start-Sleep -Milliseconds 800
}

Write-Host ""
Write-Host "=== PROBING BACKGROUND CANDIDATES ===" -ForegroundColor Cyan
Write-Host "Total to test: $($backgrounds.Count)" -ForegroundColor Gray
Write-Host ""

foreach ($file in $backgrounds) {
    $url = "$baseUrl$file"
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 8 -ErrorAction Stop
        $status = $response.StatusCode
        if ($status -eq 200) {
            Write-Host "  [OK] $file" -ForegroundColor Green
            $foundBackgrounds += $file
        } else {
            Write-Host "  [$status] $file" -ForegroundColor Yellow
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code) {
            Write-Host "  [$code] $file" -ForegroundColor DarkGray
        } else {
            Write-Host "  [ERR] $file - $($_.Exception.Message)" -ForegroundColor Red
        }
        $notFound += $file
    }
    Start-Sleep -Milliseconds 800
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FOUND SPRITES ($($foundSprites.Count)):" -ForegroundColor Green
$foundSprites | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
Write-Host ""
Write-Host "FOUND BACKGROUNDS ($($foundBackgrounds.Count)):" -ForegroundColor Green
$foundBackgrounds | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
Write-Host ""
Write-Host "Total found: $($foundSprites.Count + $foundBackgrounds.Count)" -ForegroundColor Cyan
Write-Host "Not found / errors: $($notFound.Count)" -ForegroundColor DarkGray

# Save results to file
$results = @{
    sprites = $foundSprites
    backgrounds = $foundBackgrounds
}
$results | ConvertTo-Json | Out-File -FilePath "c:\Users\LOD\Desktop\scratchjr\cdn_results.json" -Encoding UTF8
Write-Host ""
Write-Host "Results saved to cdn_results.json" -ForegroundColor Cyan
